"""Defines the catalog of realtime event types pushed over WebSockets and a
helper to build a well-formed event payload for broadcasting.
"""

from datetime import datetime, timezone
from enum import StrEnum


class EventType(StrEnum):
    """Enumerates every realtime event name the system can broadcast, covering
    workflow lifecycle, agent progress, shipment status, review, and
    notification events."""

    WORKFLOW_STARTED = "workflow.started"
    WORKFLOW_COMPLETED = "workflow.completed"
    WORKFLOW_FAILED = "workflow.failed"
    WORKFLOW_PAUSED = "workflow.paused"
    AGENT_STARTED = "workflow.agent.started"
    AGENT_COMPLETED = "workflow.agent.completed"
    AGENT_FAILED = "workflow.agent.failed"
    SHIPMENT_STATUS_UPDATED = "shipment.status.updated"
    REVIEW_CREATED = "review.created"
    REVIEW_COMPLETED = "review.completed"
    NOTIFICATION_CREATED = "notification.created"


def build_event(event_type: EventType, workflow_id: str | None, shipment_id: str | None, data: dict) -> dict:
    """Assembles the standard event dict (type, UTC timestamp, workflow/shipment
    ids, and payload data) sent to WebSocket clients."""
    return {
        "event": event_type.value,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "workflow_id": workflow_id,
        "shipment_id": shipment_id,
        "data": data,
    }
