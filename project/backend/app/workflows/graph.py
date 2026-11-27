"""Builds and compiles the LangGraph StateGraph that wires the six agent nodes into the end-to-end workflow."""

import logging
import uuid
from datetime import datetime, timezone

from langgraph.graph import END, StateGraph
from langgraph.types import interrupt
from sqlalchemy import select

from app.database.models import Vessel, VesselPosition
from app.database.session import AsyncSessionLocal
from app.repositories.workflow_repo import WorkflowRepository
from app.workflows.agents import (
    congestion_agent,
    documentation_agent,
    escalation_agent,
    risk_agent,
    scheduling_agent,
    tracking_agent,
)
from app.workflows.routing import route_after_escalation, route_after_risk
from app.workflows.state import WorkflowState

logger = logging.getLogger(__name__)

_compiled_graph = None


async def _record_vessel_position(tracking_result: dict) -> None:
    """Upserts a Vessel row (by name, since no real IMO number is collected
    at shipment creation yet) and inserts a VesselPosition from the Tracking
    Agent's output, so the Vessels workspace has real rows to list instead
    of only ever showing the transient per-run simulator output. Failures
    here are logged and swallowed - this is a secondary record of data the
    workflow already produced, never something the pipeline itself depends
    on, so it must never be able to fail a shipment's processing.
    """
    vessel_name = tracking_result.get("vessel_name")
    if not vessel_name:
        return
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Vessel).where(Vessel.name == vessel_name))
            vessel = result.scalar_one_or_none()
            if vessel is None:
                vessel = Vessel(name=vessel_name, imo_number=f"SIM{uuid.uuid4().hex[:9].upper()}", vessel_type="simulated")
                db.add(vessel)
                await db.flush()

            position = tracking_result.get("position") or {}
            eta_raw = tracking_result.get("eta")
            eta = datetime.fromisoformat(eta_raw) if eta_raw else None
            db.add(
                VesselPosition(
                    vessel_id=vessel.id,
                    latitude=position.get("lat", 0),
                    longitude=position.get("lon", 0),
                    speed_knots=tracking_result.get("speed_knots"),
                    eta=eta,
                    recorded_at=datetime.now(timezone.utc),
                    source=tracking_result.get("data_source", "simulator"),
                )
            )
            await db.commit()
    except Exception as exc:  # noqa: BLE001 - this is best-effort bookkeeping, never a pipeline failure
        logger.warning("Failed to record vessel position (non-fatal): %s", exc)


def _instrumented(agent_name: str, agent_fn):
    """Wraps an agent node with AgentRun/AgentResult persistence so the Admin
    "Agent Runs" view has real data, without changing the agent's own logic
    or return value at all. Only applied to the five nodes that run in a
    straight line (tracking through scheduling) - escalation_node is
    deliberately left unwrapped, since it calls LangGraph's interrupt() and
    wrapping that in a generic try/except here would risk mishandling the
    control-flow signal interrupt() uses to pause the graph.
    """

    async def node(state: WorkflowState) -> dict:
        workflow_id = state.get("workflow_id")
        started_at = datetime.now(timezone.utc)
        run_id = None
        if workflow_id:
            try:
                async with AsyncSessionLocal() as db:
                    repo = WorkflowRepository(db)
                    run = await repo.start_agent_run(uuid.UUID(workflow_id), agent_name)
                    run_id = run.id
                    await db.commit()
            except Exception as exc:  # noqa: BLE001 - never block the actual workflow on bookkeeping
                logger.warning("Failed to record start of agent run '%s' (non-fatal): %s", agent_name, exc)

        try:
            output = await agent_fn(state)
        except Exception:
            if run_id is not None:
                try:
                    duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
                    async with AsyncSessionLocal() as db:
                        repo = WorkflowRepository(db)
                        run = await repo.get_agent_run(run_id)
                        if run is not None:
                            await repo.fail_agent_run(run, duration_ms, "AGENT_ERROR")
                            await db.commit()
                except Exception as exc:  # noqa: BLE001 - never mask the real error with a bookkeeping failure
                    logger.warning("Failed to record failure of agent run '%s' (non-fatal): %s", agent_name, exc)
            raise

        if agent_name == "tracking_agent":
            tracking_result = output.get("tracking_result")
            if tracking_result:
                await _record_vessel_position(tracking_result)

        if run_id is not None:
            try:
                duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
                async with AsyncSessionLocal() as db:
                    repo = WorkflowRepository(db)
                    run = await repo.get_agent_run(run_id)
                    if run is not None:
                        await repo.finish_agent_run(run, "COMPLETED", output, duration_ms)
                        await db.commit()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to record completion of agent run '%s' (non-fatal): %s", agent_name, exc)

        return output

    return node


async def escalation_node(state: WorkflowState) -> dict:
    """Wraps escalation_agent with LangGraph's interrupt() so the graph
    actually pauses and checkpoints here, rather than just flagging a field
    and continuing. Resuming with a Command(resume=...) carrying the
    officer's decision is what unblocks this call.
    """
    partial = await escalation_agent(state)
    decision = interrupt(
        {
            "review_request_id": partial["review_request_id"],
            "shipment_id": state.get("shipment_id"),
            "reason": "Risk/documentation signals require human review.",
        }
    )
    return {**partial, "human_decision": decision, "workflow_status": "RUNNING"}


async def finalize_node(state: WorkflowState) -> dict:
    """Assemble the combined output of all agent nodes into final_result and mark the workflow completed."""
    final_result = {
        "tracking": state.get("tracking_result"),
        "document": state.get("document_result"),
        "congestion": state.get("congestion_result"),
        "risk": state.get("risk_result"),
        "scheduling": state.get("scheduling_result"),
        "human_decision": state.get("human_decision"),
    }
    return {"final_result": final_result, "workflow_status": "COMPLETED"}


def build_graph():
    """Construct the workflow's StateGraph: register each agent as a node and wire up the edges between them.

    The happy path runs tracking -> documentation -> congestion -> risk in a
    straight line. After risk classification, a conditional edge
    (route_after_risk) either sends the run straight to scheduling or diverts
    it to the escalation node, where it pauses for human review. A second
    conditional edge (route_after_escalation) resumes that paused run once a
    decision is available, sending it on to scheduling or straight to
    finalize depending on what the reviewer decided. Scheduling always
    finishes into finalize, which produces the combined result and ends the
    graph.
    """
    graph = StateGraph(WorkflowState)

    graph.add_node("tracking", _instrumented("tracking_agent", tracking_agent))
    graph.add_node("documentation", _instrumented("documentation_agent", documentation_agent))
    graph.add_node("congestion", _instrumented("congestion_agent", congestion_agent))
    graph.add_node("risk", _instrumented("risk_agent", risk_agent))
    graph.add_node("scheduling", _instrumented("scheduling_agent", scheduling_agent))
    graph.add_node("escalation", escalation_node)
    graph.add_node("finalize", finalize_node)

    graph.set_entry_point("tracking")
    graph.add_edge("tracking", "documentation")
    graph.add_edge("documentation", "congestion")
    graph.add_edge("congestion", "risk")

    graph.add_conditional_edges("risk", route_after_risk, {"escalate": "escalation", "scheduling": "scheduling"})
    graph.add_conditional_edges("escalation", route_after_escalation, {"scheduling": "scheduling", "end": "finalize"})

    graph.add_edge("scheduling", "finalize")
    graph.add_edge("finalize", END)

    return graph


def get_compiled_graph(checkpointer):
    """Compile once per checkpointer instance and reuse across requests -
    compiling is not free and the graph definition itself is stateless."""
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph().compile(checkpointer=checkpointer)
    return _compiled_graph
