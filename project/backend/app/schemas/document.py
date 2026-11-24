"""Response schemas for shipment document metadata and validation results."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import IdStr


class DocumentOut(BaseModel):
    """Metadata about an uploaded document."""

    id: IdStr
    document_type: str
    original_filename: str
    mime_type: str
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentValidationOut(BaseModel):
    """Outcome of running validation checks against a document's extracted fields."""

    status: str
    findings: dict
