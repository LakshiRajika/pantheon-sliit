"""Business logic for creating, retrieving, and listing shipments, enforcing
per-user access control on top of the shipment repository.
"""

import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.database.models import User
from app.permissions.resource_access import assert_can_access_shipment
from app.permissions.roles import RoleName
from app.repositories.shipment_repo import ShipmentRepository


class ShipmentService:
    """Coordinates shipment creation and lookups between the API layer, the
    shipment repository, and the permission checks that gate access."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ShipmentRepository(db)

    async def create(self, user: User, payload: dict):
        """Creates a new shipment submitted by the given shipping agent and
        records a creation event on its timeline."""
        shipment = await self.repo.create(
            shipment_reference=payload["shipment_reference"],
            shipping_agent_id=user.id,
            importer_id=payload.get("importer_id"),
            cargo_description=payload.get("cargo_description"),
            cargo_category=payload.get("cargo_category"),
            origin_port=payload.get("origin_port"),
            destination_port=payload.get("destination_port"),
            status="SUBMITTED",
        )
        await self.repo.add_event(shipment.id, "SHIPMENT_CREATED", "Shipment submitted by shipping agent.", datetime.utcnow())
        await self.db.commit()
        return shipment

    async def get_authorized(self, shipment_id: uuid.UUID, user: User):
        """Fetches a shipment by id, raising NotFoundError if it doesn't exist
        and enforcing the caller's access rights before returning it."""
        shipment = await self.repo.get(shipment_id)
        if shipment is None:
            raise NotFoundError("Shipment not found.")
        assert_can_access_shipment(user, shipment)
        return shipment

    async def list_for_user(self, user: User):
        """Lists shipments visible to the user: all shipments for
        oversight/operations roles, otherwise only the user's own."""
        see_all = RoleName(user.role.name) in (
            RoleName.CUSTOMS_OFFICER, RoleName.PORT_OPERATIONS, RoleName.MANAGEMENT, RoleName.ADMIN,
        )
        return await self.repo.list_for_user(user.id, see_all)

    async def timeline(self, shipment_id: uuid.UUID, user: User):
        """Returns the event timeline for a shipment after verifying the
        caller is authorized to view it."""
        shipment = await self.get_authorized(shipment_id, user)
        return await self.repo.timeline(shipment.id)
