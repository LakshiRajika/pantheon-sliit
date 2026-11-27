"""Administrative operations: user management, audit log access, agent-run
and workflow monitoring, and a basic health check.
"""

import os

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, NotFoundError, ValidationFailedError
from app.core.security import hash_password
from app.database.models import AgentRun, User, Workflow
from app.repositories.audit_repo import AuditRepository
from app.repositories.user_repo import UserRepository


class AdminService:
    """Backs the Admin workspace: managing users and roles and surfacing
    audit, agent-run, workflow, and system health information."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.audit_repo = AuditRepository(db)

    async def users(self) -> list[User]:
        """Returns all users in the system."""
        return await self.user_repo.list_all()

    async def create_user(self, email: str, full_name: str, password: str, role_name: str) -> User:
        """Creates a new user account with the given role. Raises ConflictError
        if the email is already registered, or ValidationFailedError if the
        role name doesn't exist (same checks app/api/v1/auth.py's self-service
        registration endpoint applies, since this is the same underlying
        operation performed by an administrator on someone else's behalf)."""
        if await self.user_repo.get_by_email(email):
            raise ConflictError("An account with this email already exists.")
        role = await self.user_repo.get_role_by_name(role_name)
        if role is None:
            raise ValidationFailedError(f"Unknown role '{role_name}'.")
        user = await self.user_repo.create(email, full_name, hash_password(password), role.id)
        await self.db.commit()
        return await self.user_repo.get(user.id)

    async def set_role(self, user_id, role_name: str) -> User:
        """Reassigns a user's role by name. Raises NotFoundError if the user
        or role doesn't exist."""
        user = await self.user_repo.get(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        role = await self.user_repo.get_role_by_name(role_name)
        if role is None:
            raise ValidationFailedError(f"Unknown role '{role_name}'.")
        user.role_id = role.id
        await self.db.commit()
        # The session doesn't expire attributes on commit (expire_on_commit is
        # False), so the already-loaded `role` relationship on this instance
        # would otherwise keep pointing at the old role even after role_id
        # has changed and been committed. Expire it explicitly so the next
        # fetch reloads it fresh.
        self.db.expire(user, ["role"])
        return await self.user_repo.get(user_id)

    async def set_status(self, user_id, is_active: bool) -> User:
        """Activates or deactivates a user account. Raises NotFoundError if
        the user doesn't exist."""
        user = await self.user_repo.get(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        user.is_active = is_active
        await self.db.commit()
        return await self.user_repo.get(user_id)

    async def audit_log(self, limit: int = 100):
        """Returns the most recent audit log entries, up to limit."""
        return await self.audit_repo.recent(limit)

    async def agent_runs(self, limit: int = 100):
        """Returns the most recent agent runs, newest first, up to limit."""
        result = await self.db.execute(select(AgentRun).order_by(AgentRun.started_at.desc()).limit(limit))
        return list(result.scalars().all())

    async def workflow_monitor(self):
        """Returns a count of workflows grouped by status, for an at-a-glance
        operational view."""
        result = await self.db.execute(select(Workflow.status, func.count(Workflow.id)).group_by(Workflow.status))
        return dict(result.all())

    async def health(self) -> dict:
        """Checks basic system health: database connectivity, whether at
        least one LLM provider is configured, and whether the upload
        directory is writable. The LLM check only confirms a key is present
        - it never makes an actual (billed) call to a provider just to
        render a status dot."""
        try:
            await self.db.execute(select(1))
            db_ok = True
        except Exception:
            db_ok = False

        settings = get_settings()
        llm_configured = bool(settings.groq_api_key or settings.google_api_key or settings.openrouter_api_key)

        try:
            storage_ok = os.path.isdir(settings.upload_dir) and os.access(settings.upload_dir, os.W_OK)
        except Exception:
            storage_ok = False

        return {
            "database": "ok" if db_ok else "degraded",
            "api": "ok",
            "llm_providers": "ok" if llm_configured else "not_configured",
            "document_storage": "ok" if storage_ok else "unavailable",
        }
