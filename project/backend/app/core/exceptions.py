"""Application-specific exception types and FastAPI exception handlers that turn them into JSON error responses."""

from fastapi import Request, status
from fastapi.responses import JSONResponse


class PantheonError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "PANTHEON_ERROR"

    def __init__(self, message: str, status_code: int | None = None, code: str | None = None):
        """Create the error with a message and optional overrides for its HTTP status code and error code."""
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code
        super().__init__(message)


class NotFoundError(PantheonError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"


class ForbiddenError(PantheonError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"


class UnauthorizedError(PantheonError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"


class ConflictError(PantheonError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"


class ValidationFailedError(PantheonError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "VALIDATION_FAILED"


async def pantheon_error_handler(request: Request, exc: PantheonError) -> JSONResponse:
    """Convert a PantheonError into a JSON response using its status code and error code."""
    # Never leak stack traces, internal prompts, or raw DB errors to clients.
    return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message})


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler for any uncaught exception, returning a generic 500 response without exposing details."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."},
    )


def register_exception_handlers(app) -> None:
    """Attach the PantheonError and generic exception handlers to the given FastAPI app."""
    app.add_exception_handler(PantheonError, pantheon_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
