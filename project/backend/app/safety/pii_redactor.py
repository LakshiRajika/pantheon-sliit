"""Replaces detected PII in text with stable pseudonyms so sensitive values are never sent to the LLM."""

from app.safety.pii_detector import detect_pii

_PSEUDONYM_COUNTERS: dict[str, int] = {}
_PSEUDONYM_MAP: dict[str, str] = {}


def _pseudonym_for(label: str, value: str) -> str:
    """Stable pseudonym per distinct value, e.g. EMAIL_0001.

    The mapping here is process-local and in-memory for the MVP; a real
    deployment keeps this map in protected backend storage only, never sent
    to the LLM, so original values can be recovered by authorized workflows.
    """
    key = f"{label}:{value}"
    if key not in _PSEUDONYM_MAP:
        _PSEUDONYM_COUNTERS[label] = _PSEUDONYM_COUNTERS.get(label, 0) + 1
        _PSEUDONYM_MAP[key] = f"{label}_{_PSEUDONYM_COUNTERS[label]:04d}"
    return _PSEUDONYM_MAP[key]


def redact(text: str) -> str:
    """Detect PII in the text and replace each occurrence with its pseudonym, leaving the text unchanged if none is found."""
    findings = detect_pii(text)
    if not findings:
        return text
    # Replace from the end so earlier offsets stay valid.
    for finding in sorted(findings, key=lambda f: f["start"], reverse=True):
        pseudonym = _pseudonym_for(finding["label"], finding["value"])
        text = text[: finding["start"]] + f"[{pseudonym}]" + text[finding["end"] :]
    return text
