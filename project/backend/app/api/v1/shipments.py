"""Shipment endpoints: creating shipments, listing/retrieving them, and reading their timeline of events."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission
from app.database.models import User
from app.database.session import get_db
from app.permissions.permission_catalog import Permission
from app.schemas.shipment import ShipmentCreate, ShipmentOut, ShipmentTimelineEvent
from app.services.shipment_service import ShipmentService

router = APIRouter(prefix="/shipments", tags=["shipments"])


@router.post("", response_model=ShipmentOut)
async def create_shipment(
    payload: ShipmentCreate,
    user: User = Depends(require_permission(Permission.SHIPMENT_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Create a new shipment for the current user. Requires the SHIPMENT_CREATE permission."""
    service = ShipmentService(db)
    shipment = await service.create(user, payload.model_dump())
    return ShipmentOut.model_validate(shipment)


@router.get("", response_model=list[ShipmentOut])
async def list_shipments(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List the shipments visible to the current user."""
    service = ShipmentService(db)
    shipments = await service.list_for_user(user)
    return [ShipmentOut.model_validate(s) for s in shipments]


@router.get("/{shipment_id}", response_model=ShipmentOut)
async def get_shipment(shipment_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Fetch a single shipment by id, after checking the current user is authorized to view it."""
    service = ShipmentService(db)
    shipment = await service.get_authorized(shipment_id, user)
    return ShipmentOut.model_validate(shipment)


@router.get("/{shipment_id}/timeline", response_model=list[ShipmentTimelineEvent])
async def get_timeline(shipment_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return the ordered history of tracked events for a shipment."""
    service = ShipmentService(db)
    events = await service.timeline(shipment_id, user)
    return [ShipmentTimelineEvent(event_type=e.event_type, description=e.description, occurred_at=e.occurred_at) for e in events]
