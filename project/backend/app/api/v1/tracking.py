"""Vessel tracking endpoints: listing tracked vessels and their recorded position history."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.database.models import User
from app.database.session import get_db
from app.permissions.permission_catalog import Permission
from app.services.tracking_service import TrackingService

router = APIRouter(tags=["tracking"])


@router.get("/vessels")
async def list_vessels(user: User = Depends(require_permission(Permission.TRACKING_READ)), db: AsyncSession = Depends(get_db)):
    """List tracked vessels with their id, IMO number, and name. Requires the TRACKING_READ permission."""
    service = TrackingService(db)
    vessels = await service.list_vessels()
    return [{"id": str(v.id), "imo_number": v.imo_number, "name": v.name} for v in vessels]


@router.get("/vessels/{vessel_id}/positions")
async def vessel_positions(vessel_id, user: User = Depends(require_permission(Permission.TRACKING_READ)), db: AsyncSession = Depends(get_db)):
    """Return the recorded position history (lat/lon, source, timestamp) for a given vessel. Requires the TRACKING_READ permission."""
    service = TrackingService(db)
    positions = await service.positions(vessel_id)
    return [{"lat": float(p.latitude), "lon": float(p.longitude), "recorded_at": p.recorded_at, "source": p.source} for p in positions]
