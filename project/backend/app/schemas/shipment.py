"""Request and response schemas for creating shipments, returning shipment details, and reporting timeline events."""

import re
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.common import IdStr

_REFERENCE_PATTERN = re.compile(r"^[A-Za-z0-9-]{3,50}$")


def _reject_pure_digits(value: str, field_label: str) -> str:
    """Shared check for the port fields below: rejects a value that's nothing
    but digits (e.g. "12345"), since a real port name always has at least
    one letter. Deliberately lenient otherwise - real port/terminal codes do
    mix letters, digits, and punctuation, so this only blocks the clearly
    wrong case rather than enforcing a strict place-name format."""
    stripped = value.strip()
    if not stripped:
        raise ValueError(f"{field_label} cannot be blank.")
    if stripped.isdigit():
        raise ValueError(f"{field_label} must be a place name, not a number.")
    return stripped


class ShipmentCreate(BaseModel):
    """Fields submitted when registering a new shipment."""

    shipment_reference: str
    vessel_name: str | None = None
    cargo_description: str | None = None
    cargo_category: str | None = None
    origin_port: str | None = None
    destination_port: str | None = None
    importer_id: str | None = None

    @field_validator("shipment_reference")
    @classmethod
    def validate_reference(cls, value: str) -> str:
        if not _REFERENCE_PATTERN.match(value.strip()):
            raise ValueError("Shipment reference must be 3-50 characters of letters, digits, and hyphens.")
        return value.strip()

    @field_validator("origin_port", "destination_port")
    @classmethod
    def validate_port(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _reject_pure_digits(value, "Port")


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
