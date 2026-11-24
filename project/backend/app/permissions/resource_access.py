"""Resource-level (ownership/scope) access checks that run in addition to role-based permission checks."""

import uuid

from app.core.exceptions import ForbiddenError
from app.database.models import Shipment, User
from app.permissions.roles import RoleName


def assert_can_access_shipment(user: User, shipment: Shipment) -> None:
    """Role grants the *type* of access; this enforces *whose* record it is.

    Customs, port operations, management and admin see all shipments (their
    role permission is SHIPMENT_READ_ALL). Shipping agents and importers only
    see shipments they own or are the counterparty on.
    """
    role = RoleName(user.role.name)
    if role in (RoleName.CUSTOMS_OFFICER, RoleName.PORT_OPERATIONS, RoleName.MANAGEMENT, RoleName.ADMIN):
        return
    if role == RoleName.SHIPPING_AGENT and shipment.shipping_agent_id == user.id:
        return
    if role == RoleName.IMPORTER_EXPORTER and shipment.importer_id == user.id:
        return
    raise ForbiddenError("You do not have access to this shipment.")


def assert_can_access_conversation(owner_id: uuid.UUID, user: User) -> None:
    """Raise ForbiddenError unless the requesting user is the owner of the conversation."""
    if owner_id != user.id:
        raise ForbiddenError("You do not have access to this conversation.")
