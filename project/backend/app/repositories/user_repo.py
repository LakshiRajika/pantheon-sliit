"""Data access for user accounts and roles."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.models import Role, User


class UserRepository:
    """Async CRUD and lookup operations for User and Role records."""

    def __init__(self, db: AsyncSession):
        """Stores the database session used for all queries issued by this repository."""
        self.db = db

    async def get_by_email(self, email: str) -> User | None:
        """Fetches a user (with role eagerly loaded) by email address, or None if not found."""
        result = await self.db.execute(select(User).options(selectinload(User.role)).where(User.email == email))
        return result.scalar_one_or_none()

    async def get(self, user_id: uuid.UUID) -> User | None:
        """Fetches a user (with role eagerly loaded) by ID, or None if not found."""
        result = await self.db.execute(select(User).options(selectinload(User.role)).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_role_by_name(self, name: str) -> Role | None:
        """Fetches a Role record by its name, or None if not found."""
        result = await self.db.execute(select(Role).where(Role.name == name))
        return result.scalar_one_or_none()

    async def create(self, email: str, full_name: str, password_hash: str, role_id: uuid.UUID) -> User:
        """Creates and persists a new user with the given credentials and role."""
        user = User(email=email, full_name=full_name, password_hash=password_hash, role_id=role_id)
        self.db.add(user)
        await self.db.flush()
        return user

    async def list_all(self) -> list[User]:
        """Returns all users with their roles eagerly loaded."""
        result = await self.db.execute(select(User).options(selectinload(User.role)))
        return list(result.scalars().all())
