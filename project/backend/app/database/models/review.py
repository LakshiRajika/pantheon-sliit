"""ORM models for the human-in-the-loop review gate: review requests, officer decisions, and supporting evidence."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ReviewRequest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A request for human review raised during a workflow, pending an officer's decision."""

    __tablename__ = "review_requests"
    workflow_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflows.id"))
    shipment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shipments.id"))
    review_type: Mapped[str] = mapped_column(String(50))  # DOCUMENT_VALIDATION | RISK_ESCALATION | ...
    priority: Mapped[str] = mapped_column(String(30))  # LOW | MEDIUM | HIGH
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="PENDING")  # PENDING | RESOLVED
    assigned_officer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Point-in-time copy of the tracking/document/congestion/risk results that
    # existed when the graph escalated, taken because none of that upstream
    # state is otherwise persisted anywhere while a review is pending (it only
    # lives inside the LangGraph checkpoint, which nothing else reads back).
    context_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    decisions: Mapped[list["ReviewDecision"]] = relationship(back_populates="review_request")
    evidence: Mapped[list["ReviewEvidence"]] = relationship(back_populates="review_request")


class ReviewDecision(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A human officer's recorded decision resolving a review request."""

    __tablename__ = "review_decisions"
    review_request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("review_requests.id"))
    decided_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    decision: Mapped[str] = mapped_column(String(50))  # APPROVE_RECOMMENDATION | REJECT | REQUEST_INFORMATION
    comments: Mapped[str | None] = mapped_column(Text)

    review_request: Mapped[ReviewRequest] = relationship(back_populates="decisions")


class ReviewEvidence(Base, UUIDPrimaryKeyMixin):
    """A reference to a piece of supporting evidence (document, risk assessment, tracking data) for a review request."""

    __tablename__ = "review_evidence"
    review_request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("review_requests.id"))
    evidence_type: Mapped[str] = mapped_column(String(50))  # document | risk_assessment | tracking
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))

    review_request: Mapped[ReviewRequest] = relationship(back_populates="evidence")
