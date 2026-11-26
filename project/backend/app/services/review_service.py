"""Business logic for the human-review gate: listing pending reviews and
recording an officer's decision, which resumes the paused workflow it
belongs to.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.database.models import User
from app.repositories.review_repo import ReviewRepository
from app.repositories.workflow_repo import WorkflowRepository
from app.services.workflow_service import WorkflowService
from app.websocket.events import EventType, build_event
from app.websocket.manager import manager


class ReviewService:
    """Manages the pending-review queue and applies an officer's decision,
    coordinating between the review repository and workflow resumption."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.review_repo = ReviewRepository(db)
        self.workflow_repo = WorkflowRepository(db)
        self.workflow_service = WorkflowService(db)

    async def queue(self):
        """Returns all reviews currently pending a decision."""
        return await self.review_repo.pending_queue()

    async def get_or_404(self, review_id: uuid.UUID):
        """Fetches a review request by id, raising NotFoundError if missing."""
        review = await self.review_repo.get(review_id)
        if review is None:
            raise NotFoundError("Review request not found.")
        return review

    async def decide(self, review_id: uuid.UUID, officer: User, decision: str, comments: str | None) -> dict:
        """Records an officer's decision on a pending review, broadcasts a
        review-completed event, then resumes the associated workflow's
        LangGraph run with that decision. Rejects reviews that have already
        been resolved."""
        review = await self.get_or_404(review_id)
        if review.status != "PENDING":
            raise ConflictError("This review has already been resolved.")

        await self.review_repo.record_decision(review, officer.id, decision, comments)
        workflow = await self.workflow_repo.get(review.workflow_id)
        await self.db.commit()

        await manager.broadcast(
            build_event(EventType.REVIEW_COMPLETED, str(workflow.id), str(review.shipment_id), {"review_id": str(review.id), "decision": decision})
        )

        # Resume the exact paused graph/thread with the officer's decision.
        result = await self.workflow_service.resume(
            str(workflow.id),
            workflow.thread_id,
            review.shipment_id,
            {"decision": decision, "comments": comments},
        )
        return result
