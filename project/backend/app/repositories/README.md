# Repositories

This package is the data-access layer sitting between the service/agent
layer and the database. Each repository wraps the SQLAlchemy queries for one
or a small group of related models, keeping raw `select()`/session calls out
of business logic.

## Common pattern

Every repository follows the same shape:

- Its constructor takes a single `AsyncSession` and stores it as `self.db`.
- Each public method wraps one individual query or write operation (a
  lookup by id, a list query with a filter/order, a create, or a status
  update), performed with `await self.db.execute(...)`, `await
  self.db.get(...)`, or by adding a new ORM instance with `self.db.add(...)`
  followed by `await self.db.flush()`.
- Writes flush the session (making the change visible within the current
  transaction and populating generated fields like ids/timestamps) but do
  not commit; committing is left to the caller/unit-of-work managing the
  session.
- Methods return ORM model instances or plain lists of them, not API
  schemas - converting to response schemas is the caller's job.

## audit_repo.py

`AuditRepository` writes `AuditLog` entries (`record`) describing actions
taken by or on behalf of a user, and `SecurityEvent` entries
(`record_security_event`) for security-relevant events such as failed
logins or permission violations. `recent(limit)` returns the most recent
audit log entries, newest first.

## chat_repo.py

`ChatRepository` manages `ChatConversation` and `ChatMessage` records:
creating a conversation (`create_conversation`), fetching one by id
(`get_conversation`), listing a user's conversations newest-first
(`list_conversations`), appending a message (`add_message`), and listing a
conversation's messages in chronological order (`list_messages`).

## document_repo.py

`DocumentRepository` manages `ShipmentDocument` and `DocumentValidation`
records: generic creation from keyword arguments (`create`), fetching a
document by id (`get`), listing all documents attached to a shipment
(`list_for_shipment`), and recording a validation result for a document
(`save_validation`).

## review_repo.py

`ReviewRepository` manages `ReviewRequest` and `ReviewDecision` records:
generic creation (`create`), fetching a review by id (`get`), listing
still-pending reviews oldest-first (`pending_queue`), and resolving a review
by marking it `RESOLVED`, stamping its resolution time, and writing the
reviewer's decision (`record_decision`).

## shipment_repo.py

`ShipmentRepository` manages `Shipment` and `ShipmentEvent` records: generic
creation (`create`), fetching a shipment by id (`get`), listing shipments
newest-first and restricted to the shipping agent/importer unless `see_all`
is set (`list_for_user`), updating a shipment's status and optionally its
risk level (`update_status`), appending a timeline event (`add_event`), and
returning a shipment's events in chronological order (`timeline`).

## user_repo.py

`UserRepository` manages `User` and `Role` records: fetching a user by email
or id with its role eagerly loaded (`get_by_email`, `get`), fetching a role
by name (`get_role_by_name`), creating a new user (`create`), and listing
all users with roles eagerly loaded (`list_all`).

## workflow_repo.py

`WorkflowRepository` manages `Workflow`, `AgentRun`, and `AgentResult`
records: creating a workflow run in `RUNNING` status (`create`), fetching a
workflow by id or by its LangGraph thread id (`get`, `get_by_thread`),
updating a workflow's status and final result (`update_status`), starting
and finishing an individual agent run including its duration and result
payload (`start_agent_run`, `finish_agent_run`), and listing all agent runs
for a workflow (`list_agent_runs`).
