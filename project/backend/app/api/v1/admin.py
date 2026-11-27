"""Admin endpoints: system health, user management, audit log, and workflow/agent monitoring for administrators."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.database.models import User
from app.database.session import get_db
from app.permissions.permission_catalog import Permission
from app.schemas.auth import RegisterRequest
from app.schemas.user import RoleAssignRequest, StatusUpdateRequest, UserOut
from app.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/health")
async def health(user: User = Depends(require_permission(Permission.ADMIN_SYSTEM_READ)), db: AsyncSession = Depends(get_db)):
    """Return system health information. Requires the ADMIN_SYSTEM_READ permission."""
    service = AdminService(db)
    return await service.health()


@router.get("/users", response_model=list[UserOut])
async def list_users(user: User = Depends(require_permission(Permission.ADMIN_USERS_MANAGE)), db: AsyncSession = Depends(get_db)):
    """List all user accounts. Requires the ADMIN_USERS_MANAGE permission."""
    service = AdminService(db)
    users = await service.users()
    return [UserOut(id=str(u.id), email=u.email, full_name=u.full_name, role=u.role.name, is_active=u.is_active) for u in users]


@router.post("/users", response_model=UserOut)
async def create_user(
    payload: RegisterRequest,
    user: User = Depends(require_permission(Permission.ADMIN_USERS_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user account with a given role. Requires the ADMIN_USERS_MANAGE permission."""
    service = AdminService(db)
    created = await service.create_user(payload.email, payload.full_name, payload.password, payload.role)
    return UserOut(id=str(created.id), email=created.email, full_name=created.full_name, role=created.role.name, is_active=created.is_active)


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def assign_role(
    user_id: uuid.UUID,
    payload: RoleAssignRequest,
    user: User = Depends(require_permission(Permission.ADMIN_USERS_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    """Reassign a user's role. Requires the ADMIN_USERS_MANAGE permission."""
    service = AdminService(db)
    updated = await service.set_role(user_id, payload.role)
    return UserOut(id=str(updated.id), email=updated.email, full_name=updated.full_name, role=updated.role.name, is_active=updated.is_active)


@router.patch("/users/{user_id}/status", response_model=UserOut)
async def update_status(
    user_id: uuid.UUID,
    payload: StatusUpdateRequest,
    user: User = Depends(require_permission(Permission.ADMIN_USERS_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    """Activate or deactivate a user account. Requires the ADMIN_USERS_MANAGE permission."""
    service = AdminService(db)
    updated = await service.set_status(user_id, payload.is_active)
    return UserOut(id=str(updated.id), email=updated.email, full_name=updated.full_name, role=updated.role.name, is_active=updated.is_active)


@router.get("/audit")
async def audit_log(user: User = Depends(require_permission(Permission.ADMIN_AUDIT_READ)), db: AsyncSession = Depends(get_db)):
    """Return the audit log of actor actions and their outcomes. Requires the ADMIN_AUDIT_READ permission."""
    service = AdminService(db)
    logs = await service.audit_log()
    return [{"actor": str(l.actor_user_id), "action": l.action_type, "target": l.target_type, "success": l.success, "at": l.created_at} for l in logs]


@router.get("/agent-runs")
async def agent_runs(user: User = Depends(require_permission(Permission.ADMIN_SYSTEM_READ)), db: AsyncSession = Depends(get_db)):
    """List recent agent runs with status, duration, and retry counts. Requires the ADMIN_SYSTEM_READ permission."""
    service = AdminService(db)
    runs = await service.agent_runs()
    return [{"agent": r.agent_name, "status": r.status, "duration_ms": r.duration_ms, "retries": r.retry_count} for r in runs]


@router.get("/workflows")
async def workflow_monitor(user: User = Depends(require_permission(Permission.ADMIN_SYSTEM_READ)), db: AsyncSession = Depends(get_db)):
    """Return a monitoring view of active and recent workflows. Requires the ADMIN_SYSTEM_READ permission."""
    service = AdminService(db)
    return await service.workflow_monitor()
