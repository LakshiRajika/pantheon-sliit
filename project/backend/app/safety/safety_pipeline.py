"""Composed safety pipeline that validates, screens, and redacts user input, documents, and tool output before they reach or leave the LLM."""

import logging

from app.safety.input_validation import validate_chat_input
from app.safety.pii_redactor import redact
from app.safety.policy import is_blocked_topic
from app.safety.prompt_injection import screen_for_injection, wrap_as_untrusted

logger = logging.getLogger(__name__)


def sanitize_user_input(text: str) -> str:
    """Run user chat input through validation, prompt-injection screening, blocked-topic checking, and PII redaction in order."""
    clean = validate_chat_input(text)
    hits = screen_for_injection(clean)
    if hits:
        logger.warning("Prompt-injection markers detected in user input: %s", hits)
    if is_blocked_topic(clean):
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("This request cannot be processed.")
    return redact(clean)


def sanitize_untrusted_document_text(raw_text: str) -> str:
    """Documents are an adversarial input channel (externally supplied).
    Redact PII, then fence the remainder so an LLM never treats embedded
    text as instructions."""
    redacted = redact(raw_text)
    return wrap_as_untrusted(redacted, source="document")


def sanitize_tool_result(result_text: str) -> str:
    """Redact PII from a tool's result text and fence it as untrusted before it is shown to the LLM."""
    redacted = redact(result_text)
    return wrap_as_untrusted(redacted, source="tool_result")
