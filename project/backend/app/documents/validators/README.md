# Document Validators

This subdirectory contains deterministic, rule-based checks run against a
document's already-extracted fields (see `../extractors/`). They do not call
an LLM and make no subjective judgment calls, so their output is reproducible
and auditable on its own.

## document_validator.py

- `REQUIRED_FIELDS_BY_TYPE` is a dict mapping each known document type to the
  list of extracted field names it must contain:
  - `bill_of_lading` requires `bill_of_lading_number`, `vessel_name`, and
    `container_number`.
  - `certificate_of_origin` requires `certificate_number`.
  - `commercial_invoice` currently requires no fields.

- `validate_fields(document_type, extracted_fields)` performs a
  **field-completeness check**: it looks up the required fields for the
  given document type and checks which of them are missing or empty in
  `extracted_fields`. If any are missing, it returns
  `{"status": "MISSING_FIELDS", "findings": {"missing_fields": [...]}}`;
  otherwise it returns `{"status": "COMPLETE", "findings": {}}`. Unknown
  document types are treated as having no required fields.

- `cross_check_consistency(fields_a, fields_b, keys)` performs a
  **cross-document consistency check**: for each field name in `keys`, it
  compares the value from `fields_a` against the value from `fields_b`
  (case-insensitively, after stripping whitespace), and records a mismatch
  only when both sides have a non-empty value and those values differ. This
  is used, for example, to compare the vessel name extracted from a bill of
  lading against the vessel identity resolved independently by the tracking
  agent. If any mismatches are found, it returns
  `{"status": "INCONSISTENT", "findings": {"mismatches": [...]}}`, with each
  mismatch entry giving the field name and both original (non-normalized)
  values; otherwise it returns `{"status": "COMPLETE", "findings": {}}`.

Both functions return the same `{"status": ..., "findings": {...}}` shape so
callers can treat field-completeness and cross-document results uniformly.
