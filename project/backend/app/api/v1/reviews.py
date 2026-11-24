"""Human-review endpoints: viewing the review queue and submitting accept/reject decisions for workflow runs flagged for manual review."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.database.models import User
from app.database.session import get_db
from app.permissions.permission_catalog import Permission
from app.schemas.review import ReviewDecisionRequest, ReviewOut
from app.services.review_service import ReviewService

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/queue", response_model=list[ReviewOut])
async def review_queue(user: User = Depends(require_permission(Permission.REVIEW_QUEUE_READ)), db: AsyncSession = Depends(get_db)):
    """List pending items awaiting human review. Requires the REVIEW_QUEUE_READ permission."""
    service = ReviewService(db)
    items = await service.queue()
    return [ReviewOut.model_validate(r) for r in items]


@router.get("/{review_id}", response_model=ReviewOut)
async def get_review(review_id: uuid.UUID, user: User = Depends(require_permission(Permission.REVIEW_QUEUE_READ)), db: AsyncSession = Depends(get_db)):
    """Fetch a single review item by id, or 404 if it doesn't exist. Requires the REVIEW_QUEUE_READ permission."""
    service = ReviewService(db)
    review = await service.get_or_404(review_id)
    return ReviewOut.model_validate(review)


@router.post("/{review_id}/decision")
async def submit_decision(
    review_id: uuid.UUID,
    payload: ReviewDecisionRequest,
    user: User = Depends(require_permission(Permission.REVIEW_DECIDE)),
    db: AsyncSession = Depends(get_db),
):
    """Record a reviewer's accept/reject decision on a review item and resume the underlying workflow. Requires the REVIEW_DECIDE permission."""
    service = ReviewService(db)
    result = await service.decide(review_id, user, payload.decision, payload.comments)
    return {"status": "accepted", "workflow_result": result.get("final_result")}
