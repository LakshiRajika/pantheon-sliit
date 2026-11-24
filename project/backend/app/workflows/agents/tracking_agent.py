"""Tracking Agent: the vessel-position/ETA ingestion node that starts the workflow."""

import logging
import random
from datetime import datetime, timedelta, timezone

from app.workflows.state import WorkflowState

logger = logging.getLogger(__name__)


async def tracking_agent(state: WorkflowState) -> dict:
    """Produce the shipment's current vessel tracking signal (position, speed, ETA).

    This is a plain data-ingestion node, not an LLM reasoning step. In
    production this polls a live AIS provider. Here it falls back to a
    clearly disclosed simulator when no live feed is configured, calibrated
    around plausible Colombo-approach ETAs - never silently presented as real.
    """
    shipment_context = state.get("shipment_context", {})
    vessel_name = shipment_context.get("vessel_name", "UNKNOWN_VESSEL")

    now = datetime.now(timezone.utc)
    simulated_eta = now + timedelta(hours=random.randint(6, 72))

    result = {
        "vessel_name": vessel_name,
        "position": {"lat": round(6.9 + random.uniform(-0.5, 0.5), 4), "lon": round(79.8 + random.uniform(-0.5, 0.5), 4)},
        "speed_knots": round(random.uniform(8, 18), 1),
        "eta": simulated_eta.isoformat(),
        "eta_confidence": round(random.uniform(0.7, 0.95), 2),
        "data_source": "simulator",  # set to "ais_live" once a real feed is wired in
    }
    logger.info("tracking_agent completed for vessel=%s", vessel_name)
    return {"tracking_result": result}
