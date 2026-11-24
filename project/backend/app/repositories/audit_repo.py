"""Data access for writing audit log entries and security events."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import AuditLog, SecurityEvent


class AuditRepository:
    """Async write/query operations for AuditLog and SecurityEvent records."""

    def __init__(self, db: AsyncSession):
        """Stores the database session used for all queries issued by this repository."""
        self.db = db

    async def record(self, actor_user_id: uuid.UUID | None, action_type: str, target_type: str | None = None, target_id: str | None = None, success: bool = True, metadata_safe: dict | None = None) -> None:
        """Writes a single audit log entry describing an action taken by (or on behalf of) a user."""
        self.db.add(
            AuditLog(
                actor_user_id=actor_user_id,
                action_type=action_type,
                target_type=target_type,
                target_id=target_id,
                success=success,
                metadata_safe=metadata_safe or {},
            )
        )
        await self.db.flush()

    async def record_security_event(self, event_type: str, severity: str, detail_safe: dict | None = None) -> None:
        """Writes a security-relevant event (e.g. failed login, permission violation) to the security event log."""
        self.db.add(SecurityEvent(event_type=event_type, severity=severity, detail_safe=detail_safe or {}))
        await self.db.flush()

    async def recent(self, limit: int = 100) -> list[AuditLog]:
        """Returns the most recent audit log entries, newest first, up to limit."""
        result = await self.db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit))
        return list(result.scalars().all())
