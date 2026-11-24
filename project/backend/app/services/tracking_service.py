"""Read-only queries for vessel tracking data: the list of known vessels and
their recent recorded positions.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import Vessel, VesselPosition


class TrackingService:
    """Provides vessel and vessel-position lookups backing the tracking
    views and the vessel-tracking assistant tool."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_vessels(self) -> list[Vessel]:
        """Returns all known vessels."""
        result = await self.db.execute(select(Vessel))
        return list(result.scalars().all())

    async def positions(self, vessel_id) -> list[VesselPosition]:
        """Returns the 50 most recent recorded positions for a vessel, newest
        first."""
        result = await self.db.execute(
            select(VesselPosition).where(VesselPosition.vessel_id == vessel_id).order_by(VesselPosition.recorded_at.desc()).limit(50)
        )
        return list(result.scalars().all())
