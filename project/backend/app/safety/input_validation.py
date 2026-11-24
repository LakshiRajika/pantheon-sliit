"""Basic validation of raw chat input and file uploads before they are processed further."""

from app.core.exceptions import ValidationFailedError

MAX_CHAT_MESSAGE_CHARS = 4000


def validate_chat_input(text: str) -> str:
    """Validate a chat message's length and character content, returning the trimmed text or raising on failure."""
    if not text or not text.strip():
        raise ValidationFailedError("Message cannot be empty.")
    if len(text) > MAX_CHAT_MESSAGE_CHARS:
        raise ValidationFailedError(f"Message exceeds {MAX_CHAT_MESSAGE_CHARS} characters.")
    # Reject null bytes / control characters that have no business in chat text.
    if "\x00" in text:
        raise ValidationFailedError("Message contains invalid characters.")
    return text.strip()


def validate_upload(filename: str, mime_type: str, size_bytes: int, max_mb: int) -> None:
    """Reject an uploaded file if its MIME type, size, or filename does not meet upload constraints."""
    allowed_mime = {"application/pdf", "image/png", "image/jpeg"}
    if mime_type not in allowed_mime:
        raise ValidationFailedError(f"Unsupported file type: {mime_type}")
    if size_bytes > max_mb * 1024 * 1024:
        raise ValidationFailedError(f"File exceeds the {max_mb}MB upload limit.")
    if not filename or "/" in filename or "\\" in filename:
        raise ValidationFailedError("Invalid filename.")
