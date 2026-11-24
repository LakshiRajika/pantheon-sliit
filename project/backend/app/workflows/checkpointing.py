"""Sets up and manages the Postgres-backed LangGraph checkpointer used to persist and resume paused workflow runs."""

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.core.config import get_settings

_checkpointer: AsyncPostgresSaver | None = None
_checkpointer_ctx = None


async def init_checkpointer() -> AsyncPostgresSaver:
    """Open the Postgres checkpointer connection and run its table setup.

    Call once during FastAPI lifespan startup. LangGraph's checkpointer
    manages its OWN tables (`checkpoints`, `checkpoint_writes`, ...) in the
    same Postgres instance - never hand-roll a replacement for these."""
    global _checkpointer, _checkpointer_ctx
    settings = get_settings()
    # psycopg conninfo string (not the SQLAlchemy URL) - the checkpointer uses
    # its own psycopg connection pool, independent of the SQLAlchemy engine.
    conninfo = settings.database_url.replace("postgresql+psycopg://", "postgresql://")
    _checkpointer_ctx = AsyncPostgresSaver.from_conn_string(conninfo)
    _checkpointer = await _checkpointer_ctx.__aenter__()
    await _checkpointer.setup()
    return _checkpointer


async def close_checkpointer() -> None:
    """Close the checkpointer's connection pool. Call once during FastAPI lifespan shutdown."""
    global _checkpointer_ctx
    if _checkpointer_ctx is not None:
        await _checkpointer_ctx.__aexit__(None, None, None)


def get_checkpointer() -> AsyncPostgresSaver:
    """Return the already-initialized checkpointer singleton for use when compiling or running the graph."""
    if _checkpointer is None:
        raise RuntimeError("Checkpointer not initialized - call init_checkpointer() in app startup.")
    return _checkpointer
