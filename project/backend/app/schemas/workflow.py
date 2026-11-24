"""Response schemas for starting and tracking LangGraph multi-agent workflow runs."""

from pydantic import BaseModel


class WorkflowStartResponse(BaseModel):
    """Identifiers and initial status returned when a workflow run is started."""

    workflow_id: str
    thread_id: str
    status: str


class WorkflowStatusOut(BaseModel):
    """Current status of a workflow run, including its final result once complete."""

    workflow_id: str
    status: str
    final_result: dict | None = None


class AgentRunOut(BaseModel):
    """Execution details for a single agent's run within a workflow."""

    agent_name: str
    status: str
    duration_ms: int | None
    retry_count: int
