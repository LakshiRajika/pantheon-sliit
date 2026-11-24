"""User profile endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.models import User
from app.database.session import get_db
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def my_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return the currently authenticated user's own profile."""
    return UserOut(id=str(user.id), email=user.email, full_name=user.full_name, role=user.role.name, is_active=user.is_active)
