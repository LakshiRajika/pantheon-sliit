# Alembic Migrations

This package holds the Alembic setup used to version and apply PostgreSQL schema changes for the project.

## env.py

This is Alembic's environment script — the entry point Alembic runs before generating or applying any migration.
Its responsibilities:

- **Windows event-loop fix.** Before anything else, it calls `use_selector_event_loop_on_windows()` (from
  `app.core.event_loop`). On Windows, asyncio defaults to the `ProactorEventLoop`, which psycopg's async driver does
  not support; this call switches the event loop policy to `WindowsSelectorEventLoopPolicy` so the async engine
  below can actually open a connection on Windows. On other platforms this is a no-op.
- **Wiring up app configuration.** It pulls the real database URL from `app.core.config.get_settings()` and sets it
  as Alembic's `sqlalchemy.url`, so migrations run against the same database the application itself is configured
  to use, instead of a hardcoded URL in `alembic.ini`.
- **Registering models.** It imports `app.database.base.Base` and then does `from app.database.models import *` so
  every ORM model class gets defined and registered on `Base.metadata`. `target_metadata` is set to that metadata
  object, which is what `alembic revision --autogenerate` diffs against to detect schema changes.
- **Offline vs. online migrations.** `run_migrations_offline()` generates SQL as literal statements without
  opening a database connection (used for `--sql` output). `run_migrations_online()` builds a temporary async
  engine (`async_engine_from_config`, with `NullPool` since it's short-lived), opens a connection, and runs the
  migration via `connection.run_sync(do_run_migrations)` since Alembic's migration context itself is synchronous.
  The script picks between the two based on `context.is_offline_mode()`.

## script.py.mako

This is the Mako template Alembic fills in to create each new migration file (the `revision`, `down_revision`,
`upgrade()`, and `downgrade()` skeleton). Normally this file is created automatically by running `alembic init`,
but this project's Alembic setup was wired up by hand rather than via `alembic init`, so `script.py.mako` is checked
into the repository manually instead of being generated. It must stay in place for `alembic revision` to work.

## versions/

Contains the actual migration scripts, one per revision, each named `<revision_id>_<slug>.py`. Every script defines
`upgrade()` and `downgrade()` functions plus `revision`/`down_revision` identifiers that chain migrations together
in order. As the schema evolves, new files accumulate here; Alembic determines which ones are pending by comparing
the chain of `down_revision` links against the revision(s) currently recorded in the database's `alembic_version`
table. The directory currently contains a single migration, `c2b79d5f60f0_initial_schema.py`, which creates the
full initial set of tables (`down_revision = None`, i.e. the root of the chain).
