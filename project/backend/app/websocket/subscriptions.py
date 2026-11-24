"""Defines which realtime event name prefixes each role is authorized to
receive, independent of whether their connection itself is authenticated.
"""

from app.database.models import User
from app.permissions.roles import RoleName

# Event-level authorization, independent of connection authentication - a
# Customs Officer sees review.* events; an importer gets a sanitized
# shipment.status.updated but never internal risk evidence (section 14).
ROLE_EVENT_SCOPES: dict[RoleName, set[str]] = {
    RoleName.CUSTOMS_OFFICER: {"review.", "workflow.", "shipment.status"},
    RoleName.PORT_OPERATIONS: {"workflow.", "shipment.status", "tracking."},
    RoleName.SHIPPING_AGENT: {"workflow.", "shipment.status"},
    RoleName.IMPORTER_EXPORTER: {"shipment.status"},
    RoleName.MANAGEMENT: {"workflow.", "shipment.status"},
    RoleName.ADMIN: {"system.", "workflow.", "review.", "shipment.status"},
}


def is_event_authorized(user: User, event_name: str) -> bool:
    """Checks whether the given user's role is scoped to receive an event with
    this name, based on the role's allowed event-name prefixes."""
    role = RoleName(user.role.name)
    prefixes = ROLE_EVENT_SCOPES.get(role, set())
    return any(event_name.startswith(prefix) for prefix in prefixes)
