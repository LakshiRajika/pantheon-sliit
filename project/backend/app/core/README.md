# Core

This directory holds the cross-cutting infrastructure that the rest of the backend depends on: configuration loading, logging setup, error handling, password/token security, and a platform-specific startup fix. Nothing here is domain-specific (shipments, documents, etc.) — it's the plumbing every other module builds on.

## Files

- **`config.py`** — Defines the `Settings` class (a Pydantic `BaseSettings`) that loads all configuration from environment variables and a `.env` file: app metadata, the database URL, JWT secret/algorithm/expiry, the three LLM provider API keys and model names (Groq, Gemini, OpenRouter), upload limits, CORS origins, and log level. `get_settings()` is `lru_cache`d so the whole process shares one `Settings` instance instead of re-parsing the environment on every call.

- **`event_loop.py`** — `use_selector_event_loop_on_windows()` switches asyncio to the selector-based event loop policy on Windows at startup, working around compatibility issues some libraries have with the default proactor loop on that platform. No-op on other platforms.

- **`exceptions.py`** — Defines the application's exception hierarchy: `PantheonError` (base, HTTP 400) and its subclasses `NotFoundError` (404), `ForbiddenError` (403), `UnauthorizedError` (401), `ConflictError` (409), and `ValidationFailedError` (422). Each carries an HTTP status code and a short machine-readable `code`. Also provides `pantheon_error_handler` and `unhandled_error_handler`, the two FastAPI exception handlers that turn these (and any uncaught exception) into JSON error responses without leaking stack traces, internal prompts, or raw DB errors to the client, and `register_exception_handlers()` to wire both onto the FastAPI app.

- **`logging.py`** — `configure_logging()` sets up the root logger with a single stdout stream handler and a standard timestamp/level/name/message format, and quiets noisy third-party loggers (`httpx`, `uvicorn.access`) to `WARNING` so they don't leak secrets or prompts at `INFO`.

- **`security.py`** — Password hashing (`hash_password`/`verify_password`, Argon2-based) and JWT access-token handling (`create_access_token`, `decode_token`). Tokens carry `sub` (user id), `role`, issue/expiry times, and a `type` claim. The role in the token is treated only as a cache from login time — it is never trusted alone for authorization; callers re-check permissions server-side on every request (see `app/auth`).

## How the pieces relate

`config.py` is the common dependency: `security.py` reads JWT settings from it, and the LLM provider module in `app/llm` reads the API keys defined here. `exceptions.py` defines the error types that `security.py`'s callers (in `app/auth`) raise when a token is invalid, and that `register_exception_handlers()` converts into client-safe JSON — this is also why the handler in this file is careful never to echo internal details. `logging.py` and `event_loop.py` are both one-shot setup calls invoked at application startup, independent of everything else. Together these files give the rest of the app a single, consistent way to get settings, raise/handle errors, hash passwords, and sign/verify tokens.
