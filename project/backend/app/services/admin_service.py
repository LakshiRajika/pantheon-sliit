"""Administrative operations: user management, audit log access, agent-run
and workflow monitoring, and a basic health check.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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

    async def set_role(self, user: User, role_id) -> None:
        """Reassigns a user's role."""
        user.role_id = role_id
        await self.db.commit()

    async def set_status(self, user: User, is_active: bool) -> None:
        """Activates or deactivates a user account."""
        user.is_active = is_active
        await self.db.commit()

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
        """Checks basic system health by probing database connectivity."""
        try:
            await self.db.execute(select(1))
            db_ok = True
        except Exception:
            db_ok = False
        return {"database": "ok" if db_ok else "degraded", "api": "ok"}
