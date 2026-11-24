"""Defines the shared state schema that flows through every node of the LangGraph workflow."""

from typing import Annotated, Any, TypedDict
import operator


class WorkflowState(TypedDict, total=False):
    """The single state object passed into and returned from every agent node in the graph.

    Each node reads the fields it needs from this dict and returns a partial
    dict of updates, which LangGraph merges back in. Kept deliberately thin:
    identifiers and structured agent outputs only. Raw documents and
    unredacted PII never flow through this state - the Documentation Agent
    redacts before writing document_result.
    """

    workflow_id: str
    shipment_id: str
    thread_id: str  # LangGraph checkpoint thread id, used to resume a paused run

    shipment_context: dict[str, Any]  # input payload describing the shipment (vessel, cargo, etc.)
    document_references: list[str]  # paths/ids of submitted documents, resolved by the Documentation Agent

    tracking_result: dict[str, Any]
    document_result: dict[str, Any]
    congestion_result: dict[str, Any]
    risk_result: dict[str, Any]
    scheduling_result: dict[str, Any]

    review_required: bool  # set by the Escalation agent when a human must approve/reject
    review_request_id: str | None
    human_decision: dict[str, Any] | None  # populated on resume, after a human reviewer responds

    errors: Annotated[list[str], operator.add]  # accumulated via list concatenation across nodes
    workflow_status: str  # RUNNING | AWAITING_REVIEW | COMPLETED | FAILED
    final_result: dict[str, Any]
