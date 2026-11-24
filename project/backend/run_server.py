"""Local development entry point for the FastAPI app.

Running `uvicorn app.main:app` directly is not safe on Windows: Uvicorn
creates its asyncio event loop before it imports the application module, so
by the time `app/main.py` runs its own event-loop fix, the wrong loop type
already exists and psycopg's async driver fails to connect. This script
sets the Windows-safe event loop policy first, then starts Uvicorn
programmatically, so the loop Uvicorn creates is the correct type from the
start.
"""

from app.core.event_loop import use_selector_event_loop_on_windows

use_selector_event_loop_on_windows()

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
