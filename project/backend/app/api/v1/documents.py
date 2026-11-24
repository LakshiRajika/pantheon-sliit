"""Shipment document endpoints: uploading supporting documents and listing those already attached to a shipment."""

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission
from app.database.models import User
from app.database.session import get_db
from app.permissions.permission_catalog import Permission
from app.schemas.document import DocumentOut
from app.services.document_service import DocumentService

router = APIRouter(tags=["documents"])


@router.post("/shipments/{shipment_id}/documents", response_model=DocumentOut)
async def upload_document(
    shipment_id: uuid.UUID,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(require_permission(Permission.DOCUMENT_UPLOAD)),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document file for a shipment and store it. Requires the DOCUMENT_UPLOAD permission."""
    service = DocumentService(db)
    content = await file.read()
    document = await service.upload(shipment_id, user, file.filename, file.content_type, content, document_type)
    return DocumentOut.model_validate(document)


@router.get("/shipments/{shipment_id}/documents", response_model=list[DocumentOut])
async def list_documents(shipment_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List the documents uploaded for a given shipment."""
    service = DocumentService(db)
    docs = await service.list_for_shipment(shipment_id, user)
    return [DocumentOut.model_validate(d) for d in docs]
