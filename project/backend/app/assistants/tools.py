"""Role-scoped tool functions. Tool AVAILABILITY is not the security boundary -
each function independently re-checks permission/ownership before touching
the database, exactly as required by section 15's closing note and the
security rules in section 28.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import ReviewRequest, Shipment, User
from app.permissions.resource_access import assert_can_access_shipment
from app.repositories.review_repo import ReviewRepository
from app.repositories.shipment_repo import ShipmentRepository
from app.services.analytics_service import AnalyticsService


async def get_shipment_details(db: AsyncSession, user: User, shipment_id: str) -> dict:
    """Returns summary details for a single shipment, after confirming the
    requesting user is allowed to see it."""
    shipment = await db.get(Shipment, uuid.UUID(shipment_id))
    if shipment is None:
        return {"error": "not_found"}
    assert_can_access_shipment(user, shipment)  # re-checked here, independent of chat-level auth
    return {
        "reference": shipment.shipment_reference,
        "status": shipment.status,
        "risk_level": shipment.risk_level,
        "origin_port": shipment.origin_port,
        "destination_port": shipment.destination_port,
    }


async def get_my_shipments(db: AsyncSession, user: User) -> dict:
    """Returns the shipment references owned by or visible to the requesting
    user (never the full cross-user shipment list)."""
    repo = ShipmentRepository(db)
    shipments = await repo.list_for_user(user.id, see_all=False)
    return {"shipments": [s.shipment_reference for s in shipments]}


async def get_review_queue(db: AsyncSession, user: User) -> dict:
    """Returns a capped preview of the pending human-review queue, for
    Customs Officer-facing assistants."""
    repo = ReviewRepository(db)
    queue = await repo.pending_queue()
    return {"pending_count": len(queue), "items": [{"id": str(r.id), "priority": r.priority, "reason": r.reason} for r in queue[:10]]}


async def explain_escalation(db: AsyncSession, user: User, review_id: str) -> dict:
    """Returns the recorded reason, priority, and status behind a specific
    review escalation, so the assistant can explain it to the officer."""
    review = await db.get(ReviewRequest, uuid.UUID(review_id))
    if review is None:
        return {"error": "not_found"}
    return {"reason": review.reason, "priority": review.priority, "status": review.status}


async def get_port_kpis(db: AsyncSession, user: User) -> dict:
    """Returns the aggregate port KPI dashboard for the Management assistant."""
    service = AnalyticsService(db)
    return await service.dashboard()


# Dispatch table consulted by chat_service - never let the model invoke an
# arbitrary function name it hallucinates.
TOOL_REGISTRY = {
    "get_shipment_details": get_shipment_details,
    "get_my_shipments": get_my_shipments,
    "get_review_queue": get_review_queue,
    "explain_escalation": explain_escalation,
    "get_port_kpis": get_port_kpis,
}
