"""Authentication endpoints: user registration, login, and fetching the current user's profile."""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_user_permissions
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.database.models import LoginEvent, User
from app.database.session import get_db
from app.repositories.user_repo import UserRepository
from app.schemas.auth import LoginRequest, MeResponse, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account for the given role and return an access token for it."""
    repo = UserRepository(db)
    if await repo.get_by_email(payload.email):
        raise ConflictError("An account with this email already exists.")

    role = await repo.get_role_by_name(payload.role)
    if role is None:
        raise ConflictError(f"Unknown role '{payload.role}'. Run the seed script first.")

    user = await repo.create(payload.email, payload.full_name, hash_password(payload.password), role.id)
    await db.commit()
    token = create_access_token(str(user.id), role.name)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Verify email/password credentials, record the login attempt, and return an access token on success."""
    repo = UserRepository(db)
    user = await repo.get_by_email(payload.email)

    success = user is not None and user.is_active and verify_password(payload.password, user.password_hash)
    db.add(LoginEvent(user_id=user.id if user else None, email_attempted=payload.email, success=success))
    await db.commit()

    if not success:
        raise UnauthorizedError("Incorrect email or password.")

    token = create_access_token(str(user.id), user.role.name)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return the authenticated user's profile along with their resolved permission set."""
    perms = await get_user_permissions(user, db)
    return MeResponse(id=str(user.id), email=user.email, full_name=user.full_name, role=user.role.name, permissions=sorted(perms))
