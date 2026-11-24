"""Static mapping of roles to the permissions they are granted, used to seed the database's role-permission table."""

from app.permissions.permission_catalog import Permission as P
from app.permissions.roles import RoleName as R

# Source of truth for the role_permissions seed (see scripts/seed_data.py).
# Resource-level checks (ownership/scope) happen separately in resource_access.py -
# being granted a permission here never implies access to someone else's resource.
ROLE_PERMISSIONS: dict[R, list[P]] = {
    R.SHIPPING_AGENT: [
        P.SHIPMENT_CREATE, P.SHIPMENT_READ_OWN, P.SHIPMENT_UPDATE,
        P.DOCUMENT_UPLOAD, P.DOCUMENT_READ, P.WORKFLOW_START, P.WORKFLOW_READ,
        P.TRACKING_READ, P.CHAT_USE,
    ],
    R.CUSTOMS_OFFICER: [
        P.SHIPMENT_READ_ALL, P.DOCUMENT_READ, P.WORKFLOW_READ,
        P.REVIEW_QUEUE_READ, P.REVIEW_DECIDE, P.TRACKING_READ, P.CHAT_USE,
    ],
    R.PORT_OPERATIONS: [
        P.SHIPMENT_READ_ALL, P.WORKFLOW_READ, P.TRACKING_READ,
        P.ANALYTICS_READ_SCOPED, P.CHAT_USE,
    ],
    R.IMPORTER_EXPORTER: [
        P.SHIPMENT_READ_OWN, P.DOCUMENT_READ, P.WORKFLOW_READ,
        P.TRACKING_READ, P.CHAT_USE,
    ],
    R.MANAGEMENT: [
        P.SHIPMENT_READ_ALL, P.ANALYTICS_READ_AGGREGATE, P.WORKFLOW_READ, P.CHAT_USE,
    ],
    R.ADMIN: [
        P.ADMIN_USERS_MANAGE, P.ADMIN_SYSTEM_READ, P.ADMIN_AUDIT_READ,
        P.WORKFLOW_READ, P.WORKFLOW_RETRY, P.SHIPMENT_READ_ALL,
        # Admin deliberately has no P.CHAT_USE - no operational chatbot.
    ],
}
