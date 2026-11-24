"""Validation of LLM structured output against expected schemas and last-mile scrubbing of unsafe text before it reaches users."""

from pydantic import BaseModel, ValidationError

from app.core.exceptions import ValidationFailedError


def validate_structured_output(raw: dict, schema: type[BaseModel]) -> BaseModel:
    """Every LLM structured output is parsed through a Pydantic schema before
    it is trusted anywhere downstream (persistence, UI, another agent)."""
    try:
        return schema.model_validate(raw)
    except ValidationError as exc:
        raise ValidationFailedError(f"LLM output failed schema validation: {exc}") from exc


def strip_unsafe_text(text: str) -> str:
    """Last-mile guard: never let a raw stack trace, API key, or internal
    prompt fragment leak into a user-facing response."""
    danger_markers = ["Traceback (most recent call last)", "sk-", "gsk_", "AIza"]
    for marker in danger_markers:
        if marker in text:
            return "The assistant could not produce a safe response. Please rephrase or contact support."
    return text
