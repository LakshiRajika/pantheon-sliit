"""add review context snapshot

Revision ID: e353a485fc1e
Revises: c2b79d5f60f0
Create Date: 2026-11-27 18:58:48.080220

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e353a485fc1e'
down_revision: Union[str, None] = 'c2b79d5f60f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Note: Alembic's autogenerate also proposed dropping the
    checkpoints/checkpoint_writes/checkpoint_blobs/checkpoint_migrations
    tables here - those are LangGraph's own checkpointer tables, managed by
    langgraph-checkpoint-postgres, not by any SQLAlchemy model in this app.
    Alembic only sees tables it doesn't recognize as "to be removed"; running
    those drops would have destroyed every in-progress/paused workflow's
    checkpoint data. They were deliberately removed from this migration.
    """
    op.add_column('review_requests', sa.Column('context_snapshot', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('review_requests', 'context_snapshot')
