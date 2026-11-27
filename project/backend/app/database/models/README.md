# ORM Models

This package contains every SQLAlchemy ORM model in the backend, grouped into modules by domain. All classes inherit
from the shared `Base` declarative class (and typically the `UUIDPrimaryKeyMixin` / `TimestampMixin` mixins) defined
in `app/database/base.py`, so they all register onto the same `Base.metadata` registry.

## identity.py — identity and access

- `Role` — a named user role (e.g. officer, agent, admin) that grants a set of permissions.
- `Permission` — a single grantable permission code that can be attached to one or more roles.
- `RolePermission` — join table linking a role to a permission it grants.
- `User` — a person who can authenticate, with a single assigned role, email, hashed password, and active flag.
- `UserSession` — an issued auth session/token (identified by its JWT id) for a user, which can be revoked.
- `LoginEvent` — a record of a single login attempt, successful or not, used for auditing and security monitoring.

## logistics.py — port-logistics entities

- `Vessel` — a ship identified by its IMO number, which can carry one or more shipments.
- `VesselPosition` — a single timestamped location/speed/heading reading for a vessel, from AIS tracking or a
  simulator.
- `Shipment` — a single cargo shipment moving through the port, tracked from submission through arrival, linked to
  a vessel, shipping agent, and importer.
- `ShipmentDocument` — a single uploaded trade document (bill of lading, invoice, certificate of origin, etc.)
  attached to a shipment, referencing a file in a protected upload directory rather than a public URL.
- `DocumentExtraction` — the structured fields and redacted text extracted from a single shipment document (PII is
  redacted before storage).
- `DocumentValidation` — the outcome of validating a shipment document's extracted fields (complete, missing fields,
  or inconsistent), with JSON findings.
- `ShipmentEvent` — a single timeline event (e.g. status change or milestone) that occurred for a shipment.

## workflow.py — multi-agent workflow pipeline

- `Workflow` — a single LangGraph run processing a shipment through the agent pipeline, tied to its checkpoint
  `thread_id`, with a status (`RUNNING`, `AWAITING_REVIEW`, `COMPLETED`, `FAILED`) and final JSON result.
- `AgentRun` — a single agent's execution within a workflow, with timing, retry count, and status.
- `AgentResult` — the JSON output payload produced by a single agent run.
- `RiskAssessment` — the risk-assessment agent's verdict (risk level, confidence, contributing factors) and
  recommendation (`PROCEED` / `FLAG_FOR_INSPECTION`) for a shipment.
- `CongestionForecast` — a forecasted congestion window for a berth/terminal, optionally tied to a specific
  shipment, with a confidence score and data source (simulator or public stats).
- `SchedulingRecommendation` — the scheduling agent's recommended berth and time window for a shipment, including
  whether it reserves an inspection slot and a rationale string.

## review.py — human-in-the-loop review gate

- `ReviewRequest` — a request for human review raised during a workflow, with a type, priority, reason, status
  (`PENDING` / `RESOLVED`), an optionally assigned officer, and a `context_snapshot` JSON column: a point-in-time
  copy of the tracking/document/congestion/risk results that existed when the graph escalated, taken because that
  upstream state otherwise only lives inside the LangGraph checkpoint, which nothing else reads back.
- `ReviewDecision` — a human officer's recorded decision resolving a review request (`APPROVE_RECOMMENDATION`,
  `REJECT`, `REQUEST_INFORMATION`), with comments.
- `ReviewEvidence` — a reference to a piece of supporting evidence (document, risk assessment, or tracking data)
  attached to a review request, stored as an evidence type plus a reference id.

## chat.py — conversational assistant

- `ChatConversation` — a chat thread between a user and the assistant, scoped to the role the user had when it was
  created, with an optional title.
- `ChatMessage` — a single message (from the user or the assistant) within a conversation; content is
  PII-minimized before persistence, with additional safe metadata stored as JSON.
- `ChatToolExecution` — a record of a tool invocation triggered by an assistant message, with its outcome
  (`OK` / `DENIED` / `FAILED`) and a safe reference to its result.

## audit.py — audit and observability

- `AuditLog` — a record of an action taken by a user or the system, for compliance and traceability, including a
  correlation id and a safe (secret- and PII-free) metadata payload.
- `SecurityEvent` — a security-relevant occurrence (e.g. a blocked prompt injection or denied authorization) with a
  severity level (`LOW` / `MEDIUM` / `HIGH`).
- `SystemEvent` — a general operational event emitted by the system, outside of security or user audit concerns.
- `Notification` — an in-app notification delivered to a user, with a title, body, and read flag.

## `__init__.py`

This module imports every model class from the modules above and re-exports them (declaring them in `__all__`). The
reason this file exists rather than importing each model module individually elsewhere is for Alembic autogenerate:
`migrations/env.py` does `from app.database.models import *`, and that single import is what causes every model
class to be defined and therefore registered on `Base.metadata`. Without it, Alembic would only see whichever
models happened to already be imported elsewhere in the process, and autogenerate would silently miss tables.
