"""Root logging configuration: sets up a console handler with a standard format and quiets noisy third-party loggers."""

import logging
import sys


def configure_logging(level: str = "INFO") -> None:
    """Configure the root logger to write formatted log lines to stdout at the given level."""
    root = logging.getLogger()
    root.setLevel(level)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")
    )
    root.handlers.clear()
    root.addHandler(handler)

    # Never let third-party libraries log raw secrets or prompts at INFO.
    logging.getLogger("httpx").setLevel("WARNING")
    logging.getLogger("uvicorn.access").setLevel("WARNING")
