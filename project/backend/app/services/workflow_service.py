"""Starts and resumes LangGraph shipment-processing workflows in the
background, persisting workflow/review state and broadcasting progress
events as the graph runs.
"""

import asyncio
import uuid

from langgraph.types import Command
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationFailedError
from app.database.models import Shipment
from app.database.session import AsyncSessionLocal
from app.repositories.review_repo import ReviewRepository
from app.repositories.workflow_repo import WorkflowRepository
from app.websocket.events import EventType, build_event
from app.websocket.manager import manager
from app.workflows.checkpointing import get_checkpointer
from app.workflows.graph import get_compiled_graph


class WorkflowService:
    """Dispatches the LangGraph run asynchronously so shipment submission
    doesn't block on every agent executing (section 10). The API returns a
    workflow_id immediately; this runs in the background and persists
    results/events as it goes.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.workflow_repo = WorkflowRepository(db)
        self.review_repo = ReviewRepository(db)

    async def start(self, shipment: Shipment, document_paths: list[str]) -> str:
        """Creates a workflow record and kicks off the LangGraph run as a
        background task, returning the new workflow id immediately without
        waiting for the graph to finish. Rejects the request outright if no
        documents have been uploaded yet - the Documentation Agent already
        has a defined behavior for a missing document (it flags the
        shipment's document status as MISSING_FIELDS, which since the risk
        agent fix now correctly escalates to human review), but running an
        entire agent pipeline just to reach that already-knowable conclusion
        wastes a full workflow run and gives the shipping agent a slow,
        indirect answer to something that's really just an incomplete form
        submission."""
        if not document_paths:
            raise ValidationFailedError("Upload at least one document before starting the workflow.")

        thread_id = f"wf_{uuid.uuid4().hex[:12]}"
        workflow = await self.workflow_repo.create(shipment.id, thread_id)
        await self.db.commit()

        asyncio.create_task(self._run_graph(str(workflow.id), thread_id, shipment, document_paths))
        return str(workflow.id)

    async def _run_graph(self, workflow_id: str, thread_id: str, shipment: Shipment, document_paths: list[str]) -> None:
        """Builds the initial graph state and invokes the compiled LangGraph
        workflow for a shipment. Broadcasts a workflow-started event before
        invoking, marks the workflow failed if the graph raises, and otherwise
        hands the result off to be interpreted (either as an interrupt
        awaiting human review, or a completed outcome)."""
        checkpointer = get_checkpointer()
        graph = get_compiled_graph(checkpointer)
        config = {"configurable": {"thread_id": thread_id}}

        initial_state = {
            "workflow_id": workflow_id,
            "shipment_id": str(shipment.id),
            "thread_id": thread_id,
            # Shipment creation doesn't currently collect/link a real vessel
            # (Shipment.vessel_id is never set), so there is no genuine vessel
            # name to pass here yet - cargo_description is cargo info, not a
            # vessel identifier, and using it as one would mislabel the
            # tracking agent's output. The shipment reference is used as an
            # honest fallback label instead.
            "shipment_context": {"vessel_name": shipment.shipment_reference},
            "document_references": document_paths,
            "errors": [],
            "workflow_status": "RUNNING",
        }

        await manager.broadcast(build_event(EventType.WORKFLOW_STARTED, workflow_id, str(shipment.id), {}))

        try:
            result = await graph.ainvoke(initial_state, config=config)
        except Exception as exc:  # noqa: BLE001 - keep workflow row accurate even on unexpected failure
            await self._mark_failed(workflow_id, str(exc))
            return

        await self._handle_graph_outcome(workflow_id, thread_id, shipment.id, result)

    async def _handle_graph_outcome(self, workflow_id: str, thread_id: str, shipment_id: uuid.UUID, result: dict) -> None:
        """Interprets the graph's return value after a run or resume. If the
        graph paused on an interrupt (the escalation node asking for human
        review), creates a pending review request and marks the workflow
        AWAITING_REVIEW; otherwise marks the workflow COMPLETED with its final
        result. Either way, broadcasts the corresponding event. Runs with its
        own DB session since it is invoked from a detached background task."""
        async with AsyncSessionLocal() as db:
            workflow_repo = WorkflowRepository(db)
            review_repo = ReviewRepository(db)
            workflow = await workflow_repo.get(uuid.UUID(workflow_id))

            if result.get("__interrupt__"):
                # Graph paused at escalation_node's interrupt() call. The
                # upstream agents already ran and wrote their results into
                # this same state dict before the pause, so this is the one
                # moment that data is available anywhere outside the
                # (otherwise-opaque) LangGraph checkpoint - snapshot it now,
                # since nothing else persists it for the reviewer to see.
                interrupt_payload = result["__interrupt__"][0].value
                context_snapshot = {
                    "tracking": result.get("tracking_result"),
                    "document": result.get("document_result"),
                    "congestion": result.get("congestion_result"),
                    "risk": result.get("risk_result"),
                }
                review = await review_repo.create(
                    workflow_id=workflow.id,
                    shipment_id=shipment_id,
                    review_type="RISK_ESCALATION",
                    priority="HIGH",
                    reason=interrupt_payload.get("reason", "Review required."),
                    status="PENDING",
                    context_snapshot=context_snapshot,
                )
                await workflow_repo.update_status(workflow, "AWAITING_REVIEW")
                await db.commit()
                await manager.broadcast(
                    build_event(
                        EventType.REVIEW_CREATED,
                        workflow_id,
                        str(shipment_id),
                        {"review_id": str(review.id), "priority": review.priority, "reason": review.reason},
                    )
                )
                return

            await workflow_repo.update_status(workflow, "COMPLETED", final_result=result.get("final_result"))
            await db.commit()
            await manager.broadcast(
                build_event(EventType.WORKFLOW_COMPLETED, workflow_id, str(shipment_id), result.get("final_result") or {})
            )

    async def _mark_failed(self, workflow_id: str, safe_error: str) -> None:
        """Records a workflow as FAILED and broadcasts a sanitized failure
        event (the raw exception text is not exposed to clients)."""
        async with AsyncSessionLocal() as db:
            workflow_repo = WorkflowRepository(db)
            workflow = await workflow_repo.get(uuid.UUID(workflow_id))
            await workflow_repo.update_status(workflow, "FAILED")
            await db.commit()
        await manager.broadcast(build_event(EventType.WORKFLOW_FAILED, workflow_id, None, {"safe_error": "Workflow failed."}))

    async def resume(self, workflow_id: str, thread_id: str, shipment_id: uuid.UUID, human_decision: dict) -> dict:
        """Resumes a paused workflow from its LangGraph checkpoint with a
        human reviewer's decision injected via Command(resume=...), continuing
        execution from where it was interrupted. Called by the review service
        once an officer decides on a pending review.
        Resumes the graph from its exact checkpoint - upstream agents do
        not re-run (Workflow.md section 4 / architecture section 9)."""
        checkpointer = get_checkpointer()
        graph = get_compiled_graph(checkpointer)
        config = {"configurable": {"thread_id": thread_id}}
        try:
            result = await graph.ainvoke(Command(resume=human_decision), config=config)
        except Exception as exc:  # noqa: BLE001 - never leave the workflow stuck in AWAITING_REVIEW
            await self._mark_failed(workflow_id, str(exc))
            raise
        # Persist the post-review outcome (COMPLETED + final_result, or a new review if the
        # graph interrupts again) and broadcast it, exactly as the initial run does.
        await self._handle_graph_outcome(workflow_id, thread_id, shipment_id, result)
        return result
