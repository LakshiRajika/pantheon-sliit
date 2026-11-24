"""Risk & Inspection Agent: uses an LLM to classify shipment risk from upstream signals and recommend whether to flag it for inspection."""

import json
import logging

from pydantic import BaseModel, Field

from app.llm.provider import get_llm
from app.safety.output_validator import validate_structured_output
from app.safety.prompt_injection import wrap_as_untrusted
from app.workflows.state import WorkflowState

logger = logging.getLogger(__name__)


class RiskClassification(BaseModel):
    """Schema the LLM's risk classification output must conform to, enforced via structured-output validation."""

    risk_level: str = Field(pattern="^(LOW|MEDIUM|HIGH)$")
    confidence: float = Field(ge=0.0, le=1.0)
    recommendation: str = Field(pattern="^(PROCEED|FLAG_FOR_INSPECTION)$")
    rationale: str


SYSTEM_PROMPT = """You are the Risk & Inspection Routing agent in a port-clearance
pipeline. You classify shipment risk from structured upstream signals only.
You never see raw personal data. You do not make a final clearance decision -
you only produce a recommendation that a human customs officer may act on.
Respond with ONLY a JSON object: {"risk_level": "LOW|MEDIUM|HIGH",
"confidence": 0.0-1.0, "recommendation": "PROCEED|FLAG_FOR_INSPECTION",
"rationale": "one sentence"}."""


async def risk_agent(state: WorkflowState) -> dict:
    """Classify the shipment's risk level and recommend proceed vs. flag-for-inspection.

    Sends a summary of upstream signals (document status, injection flags,
    ETA confidence) to an LLM, which is deliberately kept away from raw
    personal data, and validates its structured response. Falls back to a
    deterministic rule if the LLM call fails, so the pipeline keeps working.
    This is the node that concentrates scarce human review effort on
    shipments that actually warrant it, instead of flagging everything or
    nothing.
    """
    doc = state.get("document_result", {})
    tracking = state.get("tracking_result", {})

    signal_summary = {
        "document_status": doc.get("status"),
        "prompt_injection_flagged": doc.get("prompt_injection_flagged", False),
        "eta_confidence": tracking.get("eta_confidence"),
    }
    user_message = wrap_as_untrusted(json.dumps(signal_summary), source="upstream_signals")

    llm = get_llm()
    try:
        response = await llm.ainvoke(
            [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_message}]
        )
        parsed = json.loads(response.content)
        classification = validate_structured_output(parsed, RiskClassification)
        result = classification.model_dump()
    except Exception as exc:
        logger.warning("risk_agent LLM call failed, falling back to deterministic rule: %s", exc)
        # Deterministic fallback keeps the pipeline functional even if every
        # LLM provider is unavailable. Treats any non-complete document status
        # (missing fields, not just outright inconsistency) as warranting
        # inspection, since an incomplete declaration is itself a risk signal.
        needs_inspection = doc.get("status") in ("INCONSISTENT", "MISSING_FIELDS")
        result = {
            "risk_level": "HIGH" if needs_inspection else "LOW",
            "confidence": 0.5 if needs_inspection else 0.9,
            "recommendation": "FLAG_FOR_INSPECTION" if needs_inspection else "PROCEED",
            "rationale": "Deterministic fallback: no LLM provider available.",
        }

    logger.info("risk_agent completed risk_level=%s", result["risk_level"])
    return {"risk_result": result}
