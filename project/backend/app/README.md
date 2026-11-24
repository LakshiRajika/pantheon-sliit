# app

This is the top-level application package for the Pantheon backend. It contains the FastAPI entry point (`main.py`) and every subpackage that makes up the service. Each subpackage has its own `README.md` with detail; this file gives a one-line orientation to each one plus an explanation of what `main.py` itself does.

## Subpackages

- **`core`** — settings, security (password hashing, JWT), logging, exceptions, and event loop configuration. See `app/core/README.md`.
- **`database`** — declarative base, async session management, ORM models, and Alembic migrations. See `app/database/README.md`.
- **`permissions`** — role, permission, and resource-access definitions used for authorization decisions. See `app/permissions/README.md`.
- **`auth`** — authentication and permission-checking dependencies used by API routes. See `app/auth/README.md`.
- **`llm`** — LLM provider selection and the Groq → Gemini → OpenRouter fallback chain used by agents and chat assistants. See `app/llm/README.md`.
- **`safety`** — input/output validation, PII handling, and prompt-injection defenses applied around LLM calls. See `app/safety/README.md`.
- **`documents`** — file storage, text/field extraction, and validation for shipment-related documents. See `app/documents/README.md`.
- **`schemas`** — Pydantic request/response models used across auth, users, shipments, documents, workflows, reviews, and chat. See `app/schemas/README.md`.
- **`repositories`** — async database access objects encapsulating queries and writes for each domain entity. See `app/repositories/README.md`.
- **`workflows`** — the LangGraph workflow package: shared state schema, routing logic, Postgres checkpointing, and the agent graph driving the port-logistics pipeline. See `app/workflows/README.md`.
- **`assistants`** — per-role AI chat assistant configuration and tool registry for the shared chat runtime. See `app/assistants/README.md`.
- **`websocket`** — the realtime layer: connection management, authentication, event definitions, and per-role event authorization. See `app/websocket/README.md`.
- **`services`** — business logic that orchestrates API routers with the database and workflow engine. See `app/services/README.md`.
- **`api`** — the versioned HTTP/WebSocket route definitions. See `app/api/README.md` and `app/api/v1/README.md`.

## main.py

`main.py` is the FastAPI application entry point. On import it calls `use_selector_event_loop_on_windows()` before anything else, so that the correct asyncio event loop policy is set before any event loop exists.

It defines an `asynccontextmanager`-based `lifespan` that runs once at startup:

1. Configures logging at the configured `log_level`.
2. Creates the upload directory (`settings.upload_dir`) if it doesn't already exist.
3. Initializes the LangGraph PostgreSQL checkpointer once via `init_checkpointer()`, so it's ready to use for every workflow run instead of being set up per-request.

On shutdown, the lifespan closes the checkpointer via `close_checkpointer()`.

The `FastAPI` app is then constructed with this lifespan, `CORSMiddleware` is added (origins from `settings.cors_origin_list`, all methods/headers allowed, credentials allowed), the global exception handlers are registered via `register_exception_handlers(app)`, and the aggregated `api_router` is mounted under `settings.api_prefix` (`/api/v1` by default).

Finally, `main.py` defines a top-level `GET /health` endpoint (outside the `/api/v1` prefix) that returns `{"status": "healthy", "app": settings.app_name}` as a basic liveness check, independent of authentication or the database.

## Why `run_server.py` exists

`run_server.py`, at the backend root (sibling to `app/`), is the script you should actually use to start the server on Windows — run it with `python run_server.py` rather than `uvicorn app.main:app` directly.

The reason is ordering: Uvicorn creates its own asyncio event loop before it imports the application module given on the command line. By the time `app/main.py` runs its own `use_selector_event_loop_on_windows()` call, Uvicorn's event loop already exists and is the wrong type, and psycopg's async driver fails to connect under it. `run_server.py` sets the Windows-safe event loop policy *first*, then starts Uvicorn programmatically (`uvicorn.run("app.main:app", ...)`), so the loop Uvicorn creates from the start is the correct type.
