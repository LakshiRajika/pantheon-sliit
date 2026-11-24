"""Request and response schemas for creating shipments, returning shipment details, and reporting timeline events."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import IdStr


class ShipmentCreate(BaseModel):
    """Fields submitted when registering a new shipment."""

    shipment_reference: str
    vessel_name: str | None = None
    cargo_description: str | None = None
    cargo_category: str | None = None
    origin_port: str | None = None
    destination_port: str | None = None
    importer_id: str | None = None


class ShipmentOut(BaseModel):
    """Public representation of a shipment and its current tracking/risk status."""

    id: IdStr
    shipment_reference: str
    status: str
    risk_level: str | None
    origin_port: str | None
    destination_port: str | None
    estimated_arrival: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ShipmentTimelineEvent(BaseModel):
    """A single event in a shipment's tracking timeline."""

    event_type: str
    description: str | None
    occurred_at: datetime
