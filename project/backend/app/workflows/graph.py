"""Builds and compiles the LangGraph StateGraph that wires the six agent nodes into the end-to-end workflow."""

from langgraph.graph import END, StateGraph
from langgraph.types import interrupt

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

_compiled_graph = None


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

    graph.add_node("tracking", tracking_agent)
    graph.add_node("documentation", documentation_agent)
    graph.add_node("congestion", congestion_agent)
    graph.add_node("risk", risk_agent)
    graph.add_node("scheduling", scheduling_agent)
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
