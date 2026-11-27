"""Request and response schemas for the human-review gate: pending reviews and the decisions made on them."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import IdStr


class ReviewOut(BaseModel):
    """A pending or resolved human-review item raised for a shipment."""

    id: IdStr
    shipment_id: IdStr
    review_type: str
    priority: str
    reason: str
    status: str
    created_at: datetime
    context_snapshot: dict | None = None

    model_config = {"from_attributes": True}


class ReviewDecisionRequest(BaseModel):
    """A reviewer's decision on a review item."""

    decision: str  # APPROVE_RECOMMENDATION | REJECT | REQUEST_INFORMATION
    comments: str | None = None
    additional_information_required: list[str] = []
