"""Regex-based detection of personally identifiable information (emails, phone numbers, passport/ID numbers) in text."""

import re

# MVP regex-based detector. Swap for a proper NER/Presidio-based detector
# before any production use - regexes will under- and over-match.
PATTERNS: dict[str, re.Pattern] = {
    "EMAIL": re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
    "PHONE": re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?(?:\d{2,4}[-.\s]?){2,4}\d{2,4}\b"),
    "PASSPORT": re.compile(r"\b[A-Z]{1,2}\d{6,9}\b"),
    "NIC_LK": re.compile(r"\b\d{9}[vVxX]\b|\b\d{12}\b"),
}


def detect_pii(text: str) -> list[dict]:
    """Scan text against the known PII regex patterns and return a list of matches with their label and position."""
    findings = []
    for label, pattern in PATTERNS.items():
        for match in pattern.finditer(text):
            findings.append({"label": label, "start": match.start(), "end": match.end(), "value": match.group()})
    return findings
