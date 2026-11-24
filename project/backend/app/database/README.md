# Database Layer

This package holds the SQLAlchemy 2 (async) foundation that the rest of the backend builds on: the shared declarative
base and mixins, and the async session/engine setup used to talk to PostgreSQL. The ORM models and Alembic migrations
live in their own subpackages, each documented separately.

## `base.py`

Defines the single `Base` declarative class (subclassing `DeclarativeBase`) that every ORM model in the project
inherits from. Because all models share this one class, they all register onto the same `Base.metadata`, which is
what lets Alembic autogenerate migrations by diffing the database against the full set of model definitions.

It also defines two reusable mixins that models combine with `Base`:

- `UUIDPrimaryKeyMixin` — adds an `id` column as a client-generated UUID primary key (`uuid.uuid4` default), so
  primary keys are available before a row is flushed to the database.
- `TimestampMixin` — adds `created_at` and `updated_at` columns, both `DateTime(timezone=True)` with
  `server_default=func.now()`; `updated_at` also sets `onupdate=func.now()` so the database (not application code)
  stamps and refreshes these timestamps.

## `session.py`

Builds the async database engine and the session factory used throughout the app:

- Reads the database URL from `app.core.config.get_settings()` and creates an async engine via
  `create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)`. The URL is expected to use the
  `postgresql+psycopg://` scheme, relying on SQLAlchemy 2's psycopg3 async support.
- `AsyncSessionLocal` is an `async_sessionmaker` bound to that engine, configured with `expire_on_commit=False` so
  loaded attributes remain usable after a commit without triggering implicit reloads.
- `get_db()` is the FastAPI dependency used by route handlers: it opens a session, yields it for the duration of the
  request, and closes it in a `finally` block regardless of whether the request succeeded or raised.

## Subpackages

`models/` contains all ORM model classes, grouped by domain (identity, logistics, workflow, review, chat, and
audit), and re-exports them from its `__init__.py` so importing that module registers every table on `Base.metadata`.
`migrations/` contains the Alembic environment (`env.py`), the migration template (`script.py.mako`), and the
`versions/` directory of generated migration scripts that evolve the schema over time. See each subpackage's own
README for details.
