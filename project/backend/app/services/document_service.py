"""Business logic for uploading and listing shipment documents, including
access control, upload validation, and persisting files to storage.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.database.models import User
from app.documents.storage import save_upload
from app.permissions.resource_access import assert_can_access_shipment
from app.repositories.document_repo import DocumentRepository
from app.repositories.shipment_repo import ShipmentRepository
from app.safety.input_validation import validate_upload


class DocumentService:
    """Coordinates document upload and retrieval for a shipment, enforcing
    shipment access rules and upload safety checks before touching storage."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.doc_repo = DocumentRepository(db)
        self.shipment_repo = ShipmentRepository(db)

    async def upload(self, shipment_id: uuid.UUID, user: User, filename: str, mime_type: str, content: bytes, document_type: str):
        """Validates and stores an uploaded document for a shipment the user
        is authorized to access, then records it in the document repository."""
        shipment = await self.shipment_repo.get(shipment_id)
        if shipment is None:
            raise NotFoundError("Shipment not found.")
        assert_can_access_shipment(user, shipment)

        settings = get_settings()
        validate_upload(filename, mime_type, len(content), settings.max_upload_size_mb)

        storage_path = save_upload(shipment_id, filename, content)
        document = await self.doc_repo.create(
            shipment_id=shipment_id,
            document_type=document_type,
            original_filename=filename,
            storage_path=storage_path,
            mime_type=mime_type,
            size_bytes=len(content),
            uploaded_by=user.id,
        )
        await self.db.commit()
        return document

    async def list_for_shipment(self, shipment_id: uuid.UUID, user: User):
        """Lists documents attached to a shipment after confirming the caller
        can access that shipment."""
        shipment = await self.shipment_repo.get(shipment_id)
        if shipment is None:
            raise NotFoundError("Shipment not found.")
        assert_can_access_shipment(user, shipment)
        return await self.doc_repo.list_for_shipment(shipment_id)
