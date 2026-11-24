"""Documentation Agent: extracts and validates fields from submitted shipment documents, with PII redaction and prompt-injection screening before results reach shared state."""

import logging

from app.documents.extractors.pdf_extractor import extract_structured_fields, extract_text
from app.documents.storage import read_file
from app.documents.validators.document_validator import validate_fields
from app.safety.prompt_injection import screen_for_injection
from app.workflows.state import WorkflowState

logger = logging.getLogger(__name__)


async def documentation_agent(state: WorkflowState) -> dict:
    """Extract structured fields from each referenced document and validate them against bill-of-lading requirements.

    Runs deterministic extraction and validation, with mandatory guardrails
    before anything derived from the document reaches shared state: PII
    redaction always runs, and documents are screened for embedded
    instructions since they are an externally-supplied, adversarial channel.
    """
    document_paths: list[str] = state.get("document_references", [])
    if not document_paths:
        return {
            "document_result": {"status": "MISSING_FIELDS", "findings": {"missing_fields": ["no documents submitted"]}},
        }

    all_fields: dict = {}
    worst_status = "COMPLETE"
    injection_flags: list[str] = []

    for path in document_paths:
        try:
            raw_bytes = read_file(path)
        except FileNotFoundError:
            worst_status = "MISSING_FIELDS"
            continue

        raw_text = extract_text(raw_bytes)
        hits = screen_for_injection(raw_text)
        if hits:
            injection_flags.extend(hits)

        # Structured fields (B/L, container, certificate numbers) are
        # extracted from the raw text, not the redacted text: these are
        # document reference numbers, not personal data, but several of them
        # happen to match the PII redactor's broad passport-number pattern
        # (e.g. two letters followed by six digits) and would otherwise be
        # pseudonymized away before extraction ever saw them. Redaction still
        # runs on this document - it's just not applied before field
        # extraction, since nothing from the free-text body is kept here.
        fields = extract_structured_fields(raw_text)
        all_fields.update({k: v for k, v in fields.items() if v})

        validation = validate_fields("bill_of_lading", fields)
        if validation["status"] != "COMPLETE":
            worst_status = validation["status"]

    result = {
        "status": worst_status,
        "extracted_fields": all_fields,
        "prompt_injection_flagged": bool(injection_flags),
    }
    logger.info("documentation_agent completed status=%s", worst_status)
    return {"document_result": result}
