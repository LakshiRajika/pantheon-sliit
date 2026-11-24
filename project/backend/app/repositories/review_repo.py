"""Data access for human-review requests and the decisions resolving them."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import ReviewDecision, ReviewRequest


class ReviewRepository:
    """Async CRUD and query operations for ReviewRequest and ReviewDecision records."""

    def __init__(self, db: AsyncSession):
        """Stores the database session used for all queries issued by this repository."""
        self.db = db

    async def create(self, **kwargs) -> ReviewRequest:
        """Creates and persists a new review request from the given field values."""
        review = ReviewRequest(**kwargs)
        self.db.add(review)
        await self.db.flush()
        return review

    async def get(self, review_id: uuid.UUID) -> ReviewRequest | None:
        """Fetches a review request by ID, or None if not found."""
        return await self.db.get(ReviewRequest, review_id)

    async def pending_queue(self) -> list[ReviewRequest]:
        """Lists review requests still awaiting a decision, oldest first."""
        result = await self.db.execute(
            select(ReviewRequest).where(ReviewRequest.status == "PENDING").order_by(ReviewRequest.created_at)
        )
        return list(result.scalars().all())

    async def record_decision(self, review: ReviewRequest, decided_by: uuid.UUID, decision: str, comments: str | None) -> ReviewDecision:
        """Marks a review request as resolved and records the reviewer's decision."""
        review.status = "RESOLVED"
        review.resolved_at = datetime.utcnow()
        record = ReviewDecision(review_request_id=review.id, decided_by=decided_by, decision=decision, comments=comments)
        self.db.add(record)
        await self.db.flush()
        return record
