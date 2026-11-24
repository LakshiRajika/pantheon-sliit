"""ORM models for audit and observability: general audit logs, security events, system events, and user notifications."""

import uuid

from sqlalchemy import JSON, Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AuditLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A record of an action taken by a user or the system, for compliance and traceability."""

    __tablename__ = "audit_logs"
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    action_type: Mapped[str] = mapped_column(String(80))
    target_type: Mapped[str | None] = mapped_column(String(80))
    target_id: Mapped[str | None] = mapped_column(String(100))
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64))
    metadata_safe: Mapped[dict] = mapped_column(JSON, default=dict)  # no secrets, no raw PII


class SecurityEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A security-relevant occurrence (e.g. a blocked prompt injection or denied authorization) with a severity level."""

    __tablename__ = "security_events"
    event_type: Mapped[str] = mapped_column(String(80))  # e.g. PROMPT_INJECTION_BLOCKED, AUTHZ_DENIED
    severity: Mapped[str] = mapped_column(String(20))  # LOW | MEDIUM | HIGH
    detail_safe: Mapped[dict] = mapped_column(JSON, default=dict)


class SystemEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A general operational event emitted by the system, outside of security or user audit concerns."""

    __tablename__ = "system_events"
    event_type: Mapped[str] = mapped_column(String(80))
    detail_safe: Mapped[dict] = mapped_column(JSON, default=dict)


class Notification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An in-app notification delivered to a user, which can be marked read."""

    __tablename__ = "notifications"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(String(1000))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
