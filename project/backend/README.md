# Pantheon Backend

Pantheon's backend is a FastAPI service for a port-logistics multi-agent system: it tracks shipments, validates uploaded documents, runs an automated risk-assessment and scheduling pipeline over them, and routes anything that needs a human decision to a review queue before the workflow continues. Access to every endpoint is governed by a role-based permission system, and a chat assistant backed by an LLM fallback chain is available per role.

## Tech stack

- **FastAPI** for the HTTP and WebSocket API.
- **SQLAlchemy 2** (async) for the ORM/data layer, with **PostgreSQL** as the database.
- **Alembic** for schema migrations.
- **LangGraph**, with a Postgres-backed checkpointer, for the multi-agent workflow engine (document validation → risk assessment → scheduling, with a human-review gate).
- **JWT-based authentication** with role-based access control (RBAC) — permissions are resolved per role and enforced per endpoint.

## Setup

1. Create and activate a virtual environment, then install dependencies:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # on Windows
   pip install -r requirements.txt
   ```
2. Copy `.env.example` to `.env` and fill in at least:
   - `DATABASE_URL`
   - `JWT_SECRET_KEY`
   - one LLM provider key (`GROQ_API_KEY`, `GOOGLE_API_KEY`, or `OPENROUTER_API_KEY`) — see below for why none of them are strictly required.
3. Start PostgreSQL via the `docker-compose.yml` at the repository root (one level above this `backend/` directory):
   ```bash
   docker compose up -d
   ```
4. Apply database migrations:
   ```bash
   alembic upgrade head
   ```
5. Seed baseline roles, permissions, and demo users:
   ```bash
   python -m scripts.seed_data
   ```
6. Start the server:
   ```bash
   python run_server.py
   ```
   Use `run_server.py` rather than `uvicorn app.main:app` directly — on Windows, Uvicorn creates its event loop before importing the app module, which is too late to apply the Windows-safe event loop policy that the async Postgres driver needs. See `app/README.md` for details.

Once running, the API is served under the `/api/v1` prefix, with a liveness check at `GET /health`.

## Demo logins

`python -m scripts.seed_data` creates one demo user per role, all sharing the same password:

| Email | Password |
|---|---|
| `shipping_agent@pantheon.demo` | `Pantheon123!` |
| `customs_officer@pantheon.demo` | `Pantheon123!` |
| `port_operations@pantheon.demo` | `Pantheon123!` |
| `importer_exporter@pantheon.demo` | `Pantheon123!` |
| `management@pantheon.demo` | `Pantheon123!` |
| `admin@pantheon.demo` | `Pantheon123!` |

## LLM fallback

Chat and agent LLM calls try providers in a fixed order and fall back automatically on failure: **Groq** (`openai/gpt-oss-120b`) → **Gemini** (`gemini-flash-latest`) → **OpenRouter**'s free router (`openrouter/free`). Each is configured via its own API key environment variable. If none of the provider keys are configured, the system still functions — it falls back to a deterministic (non-LLM) response path rather than failing outright.

## Subpackages

Each subpackage has its own README with full detail:

- [`app/`](app/README.md) — application entry point (`main.py`) and package overview.
- `app/core` — settings, security, logging, exceptions, event loop configuration.
- `app/database` — declarative base, async sessions, ORM models, migrations.
- `app/permissions` — role, permission, and resource-access definitions.
- `app/auth` — authentication and permission-checking dependencies.
- `app/llm` — LLM provider selection and fallback chain.
- `app/safety` — input/output validation, PII handling, prompt-injection defenses.
- `app/documents` — file storage, extraction, and validation for shipment documents.
- `app/schemas` — Pydantic request/response models.
- `app/repositories` — async database access objects per domain entity.
- `app/workflows` — the LangGraph workflow package.
- `app/assistants` — per-role chat assistant configuration and tool registry.
- `app/websocket` — realtime connection management and event authorization.
- `app/services` — business logic orchestrating routers, database, and workflow engine.
- [`app/api`](app/api/README.md) and [`app/api/v1`](app/api/v1/README.md) — HTTP/WebSocket route definitions.
- [`scripts`](scripts/README.md) — operational scripts, including the database seed script.
