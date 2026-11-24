"""Scheduling Agent: recommends a berth and resource allocation based on congestion forecast and inspection needs."""

import logging

from app.workflows.state import WorkflowState

logger = logging.getLogger(__name__)


async def scheduling_agent(state: WorkflowState) -> dict:
    """Produce a berth/resource recommendation for the shipment.

    Accounts for both the congestion forecast and whether the shipment needs
    an inspection slot. This agent does not execute a schedule - it only
    produces a recommendation, which remains subject to downstream human
    review for consequential cases.
    """
    congestion = state.get("congestion_result", {})
    risk = state.get("risk_result", {})

    needs_inspection_slot = risk.get("recommendation") == "FLAG_FOR_INSPECTION"
    congestion_score = congestion.get("congestion_score", 0.5)

    recommended_berth = "JCT-02" if congestion_score > 0.6 else congestion.get("berth_or_terminal", "JCT-01")

    result = {
        "recommended_berth": recommended_berth,
        "reserves_inspection_slot": needs_inspection_slot,
        "rationale": (
            f"Congestion score {congestion_score} and risk recommendation "
            f"'{risk.get('recommendation', 'UNKNOWN')}' considered jointly."
        ),
    }
    logger.info("scheduling_agent completed berth=%s", recommended_berth)
    return {"scheduling_result": result}
