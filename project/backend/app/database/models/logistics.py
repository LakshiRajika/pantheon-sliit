"""ORM models for port-logistics entities: vessels, their tracked positions, shipments, and shipment documents/events."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Vessel(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A ship identified by its IMO number, which can carry one or more shipments."""

    __tablename__ = "vessels"
    imo_number: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    vessel_type: Mapped[str | None] = mapped_column(String(80))


class VesselPosition(Base, UUIDPrimaryKeyMixin):
    """A single timestamped location/speed/heading reading for a vessel, from AIS tracking or a simulator."""

    __tablename__ = "vessel_positions"
    vessel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vessels.id"))
    latitude: Mapped[float] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float] = mapped_column(Numeric(9, 6))
    speed_knots: Mapped[float | None] = mapped_column(Numeric(5, 2))
    heading_deg: Mapped[float | None] = mapped_column(Numeric(5, 2))
    eta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(30), default="ais_live")  # ais_live | simulator


class Shipment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A single cargo shipment moving through the port, tracked from submission through arrival."""

    __tablename__ = "shipments"
    shipment_reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    vessel_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("vessels.id"))
    shipping_agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    importer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    cargo_description: Mapped[str | None] = mapped_column(Text)
    cargo_category: Mapped[str | None] = mapped_column(String(100))
    origin_port: Mapped[str | None] = mapped_column(String(150))
    destination_port: Mapped[str | None] = mapped_column(String(150))
    estimated_arrival: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_arrival: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(50), default="SUBMITTED")
    risk_level: Mapped[str | None] = mapped_column(String(30))

    documents: Mapped[list["ShipmentDocument"]] = relationship(back_populates="shipment")
    events: Mapped[list["ShipmentEvent"]] = relationship(back_populates="shipment")


class ShipmentDocument(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A single uploaded trade document (bill of lading, invoice, certificate, etc.) attached to a shipment."""

    __tablename__ = "shipment_documents"
    shipment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shipments.id"))
    document_type: Mapped[str] = mapped_column(String(80))  # bill_of_lading | invoice | certificate_of_origin | ...
    original_filename: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(500))  # path in protected upload dir, not a public URL
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column()
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    shipment: Mapped[Shipment] = relationship(back_populates="documents")


class DocumentExtraction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """The structured fields and redacted text extracted from a single shipment document."""

    __tablename__ = "document_extractions"
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shipment_documents.id"))
    extracted_fields: Mapped[dict] = mapped_column(JSON)  # PII already redacted before storage
    raw_text_redacted: Mapped[str | None] = mapped_column(Text)
    extraction_status: Mapped[str] = mapped_column(String(30), default="PENDING")  # PENDING|OK|FAILED


class DocumentValidation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """The outcome of validating a shipment document's extracted fields (complete, missing, or inconsistent)."""

    __tablename__ = "document_validations"
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shipment_documents.id"))
    status: Mapped[str] = mapped_column(String(30))  # COMPLETE | MISSING_FIELDS | INCONSISTENT
    findings: Mapped[dict] = mapped_column(JSON, default=dict)


class ShipmentEvent(Base, UUIDPrimaryKeyMixin):
    """A single timeline event (e.g. status change, milestone) that occurred for a shipment."""

    __tablename__ = "shipment_events"
    shipment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shipments.id"))
    event_type: Mapped[str] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    shipment: Mapped[Shipment] = relationship(back_populates="events")
