"""FastAPI dependencies for resolving the current authenticated user and enforcing permission requirements."""

import uuid

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token
from app.database.models import Permission, Role, RolePermission, User
from app.database.session import get_db

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode the bearer token, load the corresponding active user from the database, and return it as the request's identity."""
    try:
        payload = decode_token(token)
        user_id = uuid.UUID(payload["sub"])
    except Exception as exc:
        raise UnauthorizedError("Invalid or expired token.") from exc

    # Eager-load role here since many call sites (permission checks, response
    # schemas) read user.role.name after this dependency returns, outside
    # the async session context a lazy load would need.
    user = await db.get(User, user_id, options=[selectinload(User.role)])
    if user is None or not user.is_active:
        raise UnauthorizedError("Account is inactive or does not exist.")
    return user


async def get_user_permissions(user: User, db: AsyncSession) -> set[str]:
    """Look up the set of permission codes granted to the user's role via the role-permission mapping in the database."""
    result = await db.execute(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .where(Role.id == user.role_id)
    )
    return {row[0] for row in result.all()}


def require_permission(permission: str):
    """Backend-enforced check, independent of whatever the frontend route shows.

    Never trust a role claim in the request body; this always resolves the
    user's actual role/permissions server-side from the authenticated identity.
    """

    async def dependency(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        """Resolve the current user's permissions and reject the request if the required permission is missing."""
        perms = await get_user_permissions(user, db)
        if permission not in perms:
            raise ForbiddenError(f"Missing required permission: {permission}")
        return user

    return dependency
