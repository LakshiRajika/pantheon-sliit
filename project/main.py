"""University-track submission entry point.

Pantheon's actual implementation lives in project/backend (FastAPI +
LangGraph) and project/frontend (React) - see the root README.md for the
full architecture. This file exists to satisfy the AI Catalyst '26 required
project structure (project/main.py as the entry point); it launches the real
backend from its own directory, the same way project/backend/run_server.py
does, so that relative paths (.env, uploads/) still resolve correctly.

Run from the repository root:
    python project/main.py

The frontend is started separately - see project/frontend/README.md.
"""

import os
import sys

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
os.chdir(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)

from app.core.event_loop import use_selector_event_loop_on_windows  # noqa: E402

use_selector_event_loop_on_windows()

import uvicorn  # noqa: E402

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
