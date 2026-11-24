"""Windows-specific asyncio event loop policy fix, applied at startup to avoid platform-specific issues."""

import asyncio
import sys


def use_selector_event_loop_on_windows() -> None:
    """On Windows, switch asyncio to the selector-based event loop policy for compatibility with certain libraries."""
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())