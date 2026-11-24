"""Escalation Agent: marks a workflow run as needing human review and mints the identifier used to track that review."""

import logging
import uuid

from app.workflows.state import WorkflowState

logger = logging.getLogger(__name__)


async def escalation_agent(state: WorkflowState) -> dict:
    """Flag the workflow as awaiting human review and generate a review_request_id.

    This is the mandatory human-in-the-loop gate. This node itself only
    marks review_required and mints a review_request_id; the actual
    LangGraph interrupt and PostgreSQL review_requests row are created by the
    WorkflowService around graph execution - that keeps the *business*
    review record and the *graph* checkpoint as two separate, explicitly
    linked concerns.
    """
    review_request_id = str(uuid.uuid4())
    logger.info("escalation_agent pausing workflow for human review id=%s", review_request_id)
    return {
        "review_required": True,
        "review_request_id": review_request_id,
        "workflow_status": "AWAITING_REVIEW",
    }
