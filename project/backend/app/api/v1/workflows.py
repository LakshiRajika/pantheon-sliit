"""Workflow endpoints: starting the multi-agent processing workflow for a shipment and inspecting its status and per-agent runs."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission
from app.core.exceptions import NotFoundError
from app.database.models import User
from app.database.session import get_db
from app.permissions.permission_catalog import Permission
from app.repositories.document_repo import DocumentRepository
from app.repositories.workflow_repo import WorkflowRepository
from app.schemas.workflow import AgentRunOut, WorkflowStartResponse, WorkflowStatusOut
from app.services.shipment_service import ShipmentService
from app.services.workflow_service import WorkflowService

router = APIRouter(tags=["workflows"])


@router.post("/shipments/{shipment_id}/workflow", response_model=WorkflowStartResponse)
async def start_workflow(
    shipment_id: uuid.UUID,
    user: User = Depends(require_permission(Permission.WORKFLOW_START)),
    db: AsyncSession = Depends(get_db),
):
    """Start the agent workflow for a shipment's uploaded documents. Requires the WORKFLOW_START permission."""
    shipment_service = ShipmentService(db)
    shipment = await shipment_service.get_authorized(shipment_id, user)

    doc_repo = DocumentRepository(db)
    documents = await doc_repo.list_for_shipment(shipment_id)
    document_paths = [d.storage_path for d in documents]

    workflow_service = WorkflowService(db)
    workflow_id = await workflow_service.start(shipment, document_paths)
    return WorkflowStartResponse(workflow_id=workflow_id, thread_id="(see /workflows/{id})", status="RUNNING")


@router.get("/workflows/{workflow_id}", response_model=WorkflowStatusOut)
async def get_workflow(workflow_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return the current status and final result of a workflow run, or 404 if it doesn't exist."""
    repo = WorkflowRepository(db)
    workflow = await repo.get(workflow_id)
    if workflow is None:
        raise NotFoundError("Workflow not found.")
    return WorkflowStatusOut(workflow_id=str(workflow.id), status=workflow.status, final_result=workflow.final_result)


@router.get("/workflows/{workflow_id}/agents", response_model=list[AgentRunOut])
async def get_workflow_agents(workflow_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List the individual agent runs (name, status, duration, retries) that make up a workflow."""
    repo = WorkflowRepository(db)
    runs = await repo.list_agent_runs(workflow_id)
    return [AgentRunOut(agent_name=r.agent_name, status=r.status, duration_ms=r.duration_ms, retry_count=r.retry_count) for r in runs]
