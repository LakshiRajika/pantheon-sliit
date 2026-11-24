"""ORM models for the multi-agent workflow pipeline: workflow runs, individual agent executions and their results,
plus the risk, congestion, and scheduling outputs the agents produce."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Workflow(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A single LangGraph run processing a shipment through the agent pipeline, tied to its checkpoint thread."""

    __tablename__ = "workflows"
    shipment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shipments.id"))
    thread_id: Mapped[str] = mapped_column(String(100), unique=True)  # LangGraph checkpoint thread id
    status: Mapped[str] = mapped_column(String(30), default="RUNNING")
    # RUNNING | AWAITING_REVIEW | COMPLETED | FAILED
    final_result: Mapped[dict | None] = mapped_column(JSON)

    agent_runs: Mapped[list["AgentRun"]] = relationship(back_populates="workflow")


class AgentRun(Base, UUIDPrimaryKeyMixin):
    """A single agent's execution (with timing and retry info) within a workflow."""

    __tablename__ = "agent_runs"
    workflow_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflows.id"))
    agent_name: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(30))  # STARTED | COMPLETED | FAILED
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column()
    retry_count: Mapped[int] = mapped_column(default=0)
    safe_error_category: Mapped[str | None] = mapped_column(String(80))

    workflow: Mapped[Workflow] = relationship(back_populates="agent_runs")
    results: Mapped[list["AgentResult"]] = relationship(back_populates="agent_run")


class AgentResult(Base, UUIDPrimaryKeyMixin):
    """The output payload produced by a single agent run."""

    __tablename__ = "agent_results"
    agent_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_runs.id"))
    result_payload: Mapped[dict] = mapped_column(JSON)

    agent_run: Mapped[AgentRun] = relationship(back_populates="results")


class RiskAssessment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """The risk-assessment agent's verdict and supporting factors for a shipment."""

    __tablename__ = "risk_assessments"
    shipment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shipments.id"))
    risk_level: Mapped[str] = mapped_column(String(20))  # LOW | MEDIUM | HIGH
    confidence: Mapped[float] = mapped_column(Numeric(4, 3))
    factors: Mapped[dict] = mapped_column(JSON, default=dict)
    recommendation: Mapped[str] = mapped_column(String(30))  # PROCEED | FLAG_FOR_INSPECTION


class CongestionForecast(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A forecasted congestion window for a berth/terminal, optionally tied to a specific shipment."""

    __tablename__ = "congestion_forecasts"
    shipment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("shipments.id"))
    berth_or_terminal: Mapped[str] = mapped_column(String(100))
    forecast_window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    forecast_window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    confidence: Mapped[float] = mapped_column(Numeric(4, 3))
    data_source: Mapped[str] = mapped_column(String(30), default="simulator")  # simulator | public_stats


class SchedulingRecommendation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """The scheduling agent's recommended berth and time window for a shipment."""

    __tablename__ = "scheduling_recommendations"
    shipment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shipments.id"))
    recommended_berth: Mapped[str | None] = mapped_column(String(100))
    recommended_window_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recommended_window_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reserves_inspection_slot: Mapped[bool] = mapped_column(default=False)
    rationale: Mapped[str | None] = mapped_column(String(500))
