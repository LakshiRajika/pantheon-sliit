"""Conditional-edge functions that decide which node the graph moves to next, based on the current state."""

from app.workflows.state import WorkflowState

RISK_ESCALATION_THRESHOLD = 0.6  # below this confidence, or HIGH risk, escalate to a human


def route_after_risk(state: WorkflowState) -> str:
    """Decide where execution goes after the Risk & Inspection Agent runs.

    Inspects the risk classification together with the documentation result
    and sends the workflow down one of two paths: shipments that are
    high-risk, low-confidence, or tied to inconsistent documentation are
    routed to the escalation node so a human can review them before anything
    else happens; everything else is considered routine and proceeds
    straight to scheduling. This is the point where the graph decides whether
    a human needs to be in the loop at all.
    """
    risk = state.get("risk_result") or {}
    doc = state.get("document_result") or {}

    high_risk = risk.get("risk_level") == "HIGH"
    low_confidence = risk.get("confidence", 1.0) < RISK_ESCALATION_THRESHOLD
    doc_inconsistent = doc.get("status") == "INCONSISTENT"

    if high_risk or low_confidence or doc_inconsistent:
        return "escalate"
    return "scheduling"


def route_after_escalation(state: WorkflowState) -> str:
    """Decide where execution goes after a human reviewer's decision is resumed into the graph.

    Reads the human_decision field (populated when the paused workflow is
    resumed with the reviewer's response) and either continues the pipeline
    into scheduling, when the reviewer approved or asked for more
    information, or routes straight to the end of the workflow otherwise.
    """
    decision = (state.get("human_decision") or {}).get("decision")
    if decision in ("APPROVE_RECOMMENDATION", "REQUEST_INFORMATION"):
        return "scheduling"
    return "end"
