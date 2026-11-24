"""FastAPI application entry point: creates the app, wires up middleware, exception handlers, routers, and startup/shutdown lifecycle."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.event_loop import use_selector_event_loop_on_windows
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.workflows.checkpointing import close_checkpointer, init_checkpointer

use_selector_event_loop_on_windows()  # must run before Uvicorn creates its event loop (Windows + psycopg async)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks (logging, upload dir, checkpointer init) before serving requests, then clean up the checkpointer on shutdown."""
    configure_logging(settings.log_level)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

    # Initialize the LangGraph PostgreSQL checkpointer once at startup and
    # reuse it for every workflow run (section 6, "Backend startup/lifespan").
    await init_checkpointer()

    yield

    await close_checkpointer()


app = FastAPI(title="Pantheon API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health")
async def health():
    """Basic liveness check that reports the service is up."""
    return {"status": "healthy", "app": settings.app_name}
