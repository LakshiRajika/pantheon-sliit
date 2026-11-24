"""Computes aggregate operational KPIs (shipment counts by status/risk,
workflow run counts) for the Management dashboard.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import Shipment, Workflow


class AnalyticsService:
    """Aggregate, role-scoped KPIs only - never raw per-case evidence
    (that belongs to the Customs/Review views, not the Management dashboard)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def dashboard(self) -> dict:
        """Builds the aggregate KPI dashboard: total shipment count, counts
        grouped by status and risk level, and total workflow runs."""
        total = await self.db.scalar(select(func.count(Shipment.id)))
        by_status = await self.db.execute(select(Shipment.status, func.count(Shipment.id)).group_by(Shipment.status))
        by_risk = await self.db.execute(select(Shipment.risk_level, func.count(Shipment.id)).group_by(Shipment.risk_level))
        avg_workflows = await self.db.scalar(select(func.count(Workflow.id)))

        return {
            "total_shipments": total or 0,
            "by_status": dict(by_status.all()),
            "by_risk_level": {k or "UNCLASSIFIED": v for k, v in by_risk.all()},
            "total_workflows_run": avg_workflows or 0,
        }
