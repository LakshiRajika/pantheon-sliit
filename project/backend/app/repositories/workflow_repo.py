"""Data access for LangGraph workflow runs and the individual agent runs/results within them."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import AgentResult, AgentRun, Workflow


class WorkflowRepository:
    """Async CRUD and query operations for Workflow, AgentRun, and AgentResult records."""

    def __init__(self, db: AsyncSession):
        """Stores the database session used for all queries issued by this repository."""
        self.db = db

    async def create(self, shipment_id: uuid.UUID, thread_id: str) -> Workflow:
        """Creates and persists a new workflow run in RUNNING status for a shipment."""
        workflow = Workflow(shipment_id=shipment_id, thread_id=thread_id, status="RUNNING")
        self.db.add(workflow)
        await self.db.flush()
        return workflow

    async def get(self, workflow_id: uuid.UUID) -> Workflow | None:
        """Fetches a workflow by ID, or None if not found."""
        return await self.db.get(Workflow, workflow_id)

    async def get_by_thread(self, thread_id: str) -> Workflow | None:
        """Fetches a workflow by its LangGraph thread ID, or None if not found."""
        result = await self.db.execute(select(Workflow).where(Workflow.thread_id == thread_id))
        return result.scalar_one_or_none()

    async def update_status(self, workflow: Workflow, status: str, final_result: dict | None = None) -> None:
        """Updates a workflow's status and, if provided, its final result payload."""
        workflow.status = status
        if final_result is not None:
            workflow.final_result = final_result
        await self.db.flush()

    async def start_agent_run(self, workflow_id: uuid.UUID, agent_name: str) -> AgentRun:
        """Records the start of an agent's execution within a workflow."""
        run = AgentRun(workflow_id=workflow_id, agent_name=agent_name, status="STARTED", started_at=datetime.utcnow())
        self.db.add(run)
        await self.db.flush()
        return run

    async def finish_agent_run(self, run: AgentRun, status: str, payload: dict, duration_ms: int) -> None:
        """Marks an agent run as finished, recording its duration and result payload."""
        run.status = status
        run.ended_at = datetime.utcnow()
        run.duration_ms = duration_ms
        self.db.add(AgentResult(agent_run_id=run.id, result_payload=payload))
        await self.db.flush()

    async def list_agent_runs(self, workflow_id: uuid.UUID) -> list[AgentRun]:
        """Lists all agent runs recorded for a workflow."""
        result = await self.db.execute(select(AgentRun).where(AgentRun.workflow_id == workflow_id))
        return list(result.scalars().all())
