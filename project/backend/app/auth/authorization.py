"""Thin re-export layer so routers import authorization from one place.

Permission checks live in app.auth.dependencies.require_permission; resource
(ownership/scope) checks live in app.permissions.resource_access. Keeping
these as two distinct steps means a user can hold a permission generally
(e.g. shipment:read_own) while still being denied a *specific* resource.
"""

from app.auth.dependencies import get_current_user, require_permission
from app.permissions.resource_access import assert_can_access_conversation, assert_can_access_shipment

__all__ = [
    "get_current_user",
    "require_permission",
    "assert_can_access_shipment",
    "assert_can_access_conversation",
]
