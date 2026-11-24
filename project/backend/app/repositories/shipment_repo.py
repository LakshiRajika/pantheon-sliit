"""Data access for shipments and their tracking timeline events."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import Shipment, ShipmentEvent


class ShipmentRepository:
    """Async CRUD and query operations for Shipment and ShipmentEvent records."""

    def __init__(self, db: AsyncSession):
        """Stores the database session used for all queries issued by this repository."""
        self.db = db

    async def create(self, **kwargs) -> Shipment:
        """Creates and persists a new shipment from the given field values."""
        shipment = Shipment(**kwargs)
        self.db.add(shipment)
        await self.db.flush()
        return shipment

    async def get(self, shipment_id: uuid.UUID) -> Shipment | None:
        """Fetches a shipment by ID, or None if not found."""
        return await self.db.get(Shipment, shipment_id)

    async def list_for_user(self, user_id: uuid.UUID, see_all: bool) -> list[Shipment]:
        """Lists shipments, newest first; restricted to those the user is the shipping agent or importer for unless see_all is set."""
        stmt = select(Shipment)
        if not see_all:
            stmt = stmt.where(
                (Shipment.shipping_agent_id == user_id) | (Shipment.importer_id == user_id)
            )
        result = await self.db.execute(stmt.order_by(Shipment.created_at.desc()))
        return list(result.scalars().all())

    async def update_status(self, shipment: Shipment, status: str, risk_level: str | None = None) -> None:
        """Updates a shipment's status and, if provided, its risk level."""
        shipment.status = status
        if risk_level is not None:
            shipment.risk_level = risk_level
        await self.db.flush()

    async def add_event(self, shipment_id: uuid.UUID, event_type: str, description: str, occurred_at) -> None:
        """Appends a new timeline event for the given shipment."""
        self.db.add(ShipmentEvent(shipment_id=shipment_id, event_type=event_type, description=description, occurred_at=occurred_at))
        await self.db.flush()

    async def timeline(self, shipment_id: uuid.UUID) -> list[ShipmentEvent]:
        """Returns a shipment's events in chronological order."""
        result = await self.db.execute(
            select(ShipmentEvent).where(ShipmentEvent.shipment_id == shipment_id).order_by(ShipmentEvent.occurred_at)
        )
        return list(result.scalars().all())

