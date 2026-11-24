"""Data access for shipment documents and their validation results."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import DocumentValidation, ShipmentDocument


class DocumentRepository:
    """Async CRUD and query operations for ShipmentDocument and DocumentValidation records."""

    def __init__(self, db: AsyncSession):
        """Stores the database session used for all queries issued by this repository."""
        self.db = db

    async def create(self, **kwargs) -> ShipmentDocument:
        """Creates and persists a new document record from the given field values."""
        doc = ShipmentDocument(**kwargs)
        self.db.add(doc)
        await self.db.flush()
        return doc

    async def get(self, document_id: uuid.UUID) -> ShipmentDocument | None:
        """Fetches a document by ID, or None if not found."""
        return await self.db.get(ShipmentDocument, document_id)

    async def list_for_shipment(self, shipment_id: uuid.UUID) -> list[ShipmentDocument]:
        """Lists all documents attached to a shipment."""
        result = await self.db.execute(select(ShipmentDocument).where(ShipmentDocument.shipment_id == shipment_id))
        return list(result.scalars().all())

    async def save_validation(self, document_id: uuid.UUID, status: str, findings: dict) -> None:
        """Records a validation result for a document."""
        self.db.add(DocumentValidation(document_id=document_id, status=status, findings=findings))
        await self.db.flush()
