"""Enumeration of all permission codes that can be granted to roles and checked by API dependencies."""

from enum import StrEnum


class Permission(StrEnum):
    SHIPMENT_CREATE = "shipment:create"
    SHIPMENT_READ_OWN = "shipment:read_own"
    SHIPMENT_READ_ALL = "shipment:read_all"
    SHIPMENT_UPDATE = "shipment:update"

    DOCUMENT_UPLOAD = "document:upload"
    DOCUMENT_READ = "document:read"

    WORKFLOW_START = "workflow:start"
    WORKFLOW_READ = "workflow:read"
    WORKFLOW_RETRY = "workflow:retry"

    REVIEW_QUEUE_READ = "review:queue_read"
    REVIEW_DECIDE = "review:decide"

    TRACKING_READ = "tracking:read"
    ANALYTICS_READ_SCOPED = "analytics:read_scoped"
    ANALYTICS_READ_AGGREGATE = "analytics:read_aggregate"

    CHAT_USE = "chat:use"

    ADMIN_USERS_MANAGE = "admin:users_manage"
    ADMIN_SYSTEM_READ = "admin:system_read"
    ADMIN_AUDIT_READ = "admin:audit_read"
