"""PDF text extraction and regex-based parsing of common trade-document fields (bill of lading, container, vessel, certificate numbers)."""

import io
import logging
import re

from pypdf import PdfReader

logger = logging.getLogger(__name__)

# Trade-document field patterns. Deliberately simple for the MVP; swap for a
# layout-aware/LLM-assisted extractor as document variety grows.
# The label portion of each pattern is wrapped in a scoped (?i:...) group so
# only it is matched case-insensitively; the capture group itself stays
# case-sensitive ([A-Z0-9-]). A single trailing re.I previously made the
# capture group match lowercase letters too, so a label like "Number"
# (6 letters, no digits) could itself satisfy the {5,} length requirement
# and get captured as the value instead of the real number that follows it.
FIELD_PATTERNS = {
    "bill_of_lading_number": re.compile(r"(?i:B/?L\s*(?:No\.?|Number)?)\s*[:#]?\s*([A-Z0-9-]{5,})"),
    "container_number": re.compile(r"\b([A-Z]{4}\d{7})\b"),
    "vessel_name": re.compile(r"(?i:Vessel)\s*[:#]?\s*([A-Za-z0-9 .'-]{3,50})"),
    "certificate_number": re.compile(r"(?i:Certificate\s*(?:No\.?|Number)?)\s*[:#]?\s*([A-Z0-9-]{5,})"),
}


def extract_text(pdf_bytes: bytes) -> str:
    """Parses a PDF's raw bytes and concatenates the extracted text of all pages, returning an empty string on failure."""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
    except Exception as exc:
        logger.warning("Failed to parse PDF: %s", exc)
        return ""
    pages_text = []
    for page in reader.pages:
        try:
            pages_text.append(page.extract_text() or "")
        except Exception as exc:
            logger.warning("Failed to extract a page: %s", exc)
    return "\n".join(pages_text)


def extract_structured_fields(raw_text: str) -> dict:
    """Runs the configured FIELD_PATTERNS regexes over extracted text and returns the first match (or None) for each field."""
    fields: dict[str, str | None] = {}
    for field_name, pattern in FIELD_PATTERNS.items():
        match = pattern.search(raw_text)
        fields[field_name] = match.group(1).strip() if match else None
    return fields
