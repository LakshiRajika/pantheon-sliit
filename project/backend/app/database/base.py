"""Shared SQLAlchemy declarative base and reusable mixins for primary keys and timestamps used by all ORM models."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base class that all ORM models inherit from so their tables share one metadata registry."""

    pass


class UUIDPrimaryKeyMixin:
    """Mixin that gives a model a UUID primary key column, auto-generated client-side."""

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    """Mixin that adds created_at/updated_at columns, set and refreshed automatically by the database."""

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
