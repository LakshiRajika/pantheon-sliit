"""Rule-based validators that check extracted document fields for required-field completeness and cross-document consistency."""

REQUIRED_FIELDS_BY_TYPE = {
    "bill_of_lading": ["bill_of_lading_number", "vessel_name", "container_number"],
    "certificate_of_origin": ["certificate_number"],
    "commercial_invoice": [],
}


def validate_fields(document_type: str, extracted_fields: dict) -> dict:
    """Deterministic, rule-based validation - not an LLM judgment call, so the
    result is reproducible and auditable on its own."""
    required = REQUIRED_FIELDS_BY_TYPE.get(document_type, [])
    missing = [f for f in required if not extracted_fields.get(f)]

    if missing:
        return {"status": "MISSING_FIELDS", "findings": {"missing_fields": missing}}
    return {"status": "COMPLETE", "findings": {}}


def cross_check_consistency(fields_a: dict, fields_b: dict, keys: list[str]) -> dict:
    """E.g. compare the vessel name on the bill of lading against the
    Tracking Agent's resolved vessel identity."""
    mismatches = []
    for key in keys:
        value_a = (fields_a.get(key) or "").strip().lower()
        value_b = (fields_b.get(key) or "").strip().lower()
        if value_a and value_b and value_a != value_b:
            mismatches.append({"field": key, "a": fields_a.get(key), "b": fields_b.get(key)})
    if mismatches:
        return {"status": "INCONSISTENT", "findings": {"mismatches": mismatches}}
    return {"status": "COMPLETE", "findings": {}}
