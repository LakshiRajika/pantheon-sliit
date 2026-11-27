# Schemas

This package defines the Pydantic request and response models used by the
API layer: what each endpoint accepts as input and what shape it returns as
output.

## common.py

Defines `IdStr`, a shared field type:

```python
IdStr = Annotated[str, BeforeValidator(str)]
```

A plain `str` field in Pydantic v2 rejects a native `uuid.UUID` value
outright - unlike some other types, Pydantic's `str` validator does not
coerce a UUID into its string form automatically. Response schemas built
with `model_validate()` (via `from_attributes=True`) directly from a
SQLAlchemy ORM object receive `uuid.UUID` objects for primary/foreign keys,
so a plain `str` annotation would fail validation on every such response.
`IdStr` fixes this by running `str(...)` on the value before Pydantic's own
`str` validation, so a UUID (or anything else `str()`-able) is coerced
first.

`IdStr` is used by the schemas that are built via `model_validate()` from
ORM model instances: `ShipmentOut`, `DocumentOut`, `ReviewOut` (including its
`shipment_id` field), and `ConversationOut`. Schemas that are instead
constructed manually in router code - with `str(...)` already called
explicitly on the id when building the response object - use a plain `str`
field instead, since the coercion has already happened by the time the
value reaches Pydantic. That includes `MeResponse` and `UserOut` (both built
as `UserOut(id=str(u.id), ...)` / `MeResponse(id=str(user.id), ...)` in
`app/api/v1/*.py`), and the workflow schemas (`WorkflowStartResponse`,
`WorkflowStatusOut`, `AgentRunOut`), whose id-like fields are populated the
same way in `app/api/v1/workflows.py`.

## auth.py

Schemas for authentication endpoints:

- `LoginRequest` - email and password submitted to log in.
- `TokenResponse` - the issued access token and token type returned after a
  successful login or registration.
- `RegisterRequest` - new account details (email, password, full name,
  requested role) submitted when registering; the role is validated
  server-side against the Role table rather than trusted as-is.
- `MeResponse` - profile and permission info (id, email, full name, role,
  permission list) for the currently authenticated user.

## chat.py

Schemas for chat conversations and messages:

- `ConversationCreate` - optional title submitted when starting a new
  conversation.
- `ConversationOut` - a conversation's id, assistant role, title, and
  creation timestamp, built from an ORM object (`from_attributes=True`).
- `MessageCreate` - the content of a new message being submitted.
- `MessageOut` - a single message's role, content, and creation timestamp,
  also built from an ORM object.

## document.py

Schemas for shipment document metadata and validation results:

- `DocumentOut` - an uploaded document's id, document type, original
  filename, MIME type, size in bytes, and creation timestamp, built from an
  ORM object.
- `DocumentValidationOut` - the outcome of running validation checks against
  a document's extracted fields: a status string and a findings dict (see
  `app/documents/validators/`).

## review.py

Schemas for the human-review gate:

- `ReviewOut` - a pending or resolved review item: id, the shipment it
  belongs to, review type, priority, reason, status, creation timestamp, and
  an optional `context_snapshot` dict (the point-in-time tracking/document/
  congestion/risk snapshot taken at escalation), built from an ORM object.
- `ReviewDecisionRequest` - a reviewer's decision on a review item: the
  decision itself (`APPROVE_RECOMMENDATION`, `REJECT`, or
  `REQUEST_INFORMATION`), optional comments, and an optional list of
  additional information items required from the submitter.

## shipment.py

Schemas for shipments:

- `ShipmentCreate` - fields submitted when registering a new shipment
  (reference, vessel name, cargo description/category, origin/destination
  ports, importer id). Has field validators: `shipment_reference` must match
  `^[A-Za-z0-9-]{3,50}$` (3-50 characters of letters, digits, and hyphens),
  and `origin_port`/`destination_port` reject a value that's nothing but
  digits via a shared `_reject_pure_digits` check, since a real port name
  always has at least one letter (otherwise deliberately lenient, since real
  port/terminal codes do mix letters, digits, and punctuation).
- `ShipmentOut` - the public view of a shipment: id, reference, status, risk
  level, origin/destination ports, estimated arrival, and creation
  timestamp, built from an ORM object.
- `ShipmentTimelineEvent` - a single tracking timeline event: type,
  description, and when it occurred.

## user.py

Schemas for user administration:

- `UserOut` - the public representation of a user account: id, email, full
  name, role, and active status.
- `RoleAssignRequest` - a request to change a user's assigned role.
- `StatusUpdateRequest` - a request to activate or deactivate a user
  account.

## workflow.py

Schemas for LangGraph multi-agent workflow runs:

- `WorkflowStartResponse` - identifiers and initial status returned when a
  workflow run is started (workflow id, thread id, status).
- `WorkflowStatusOut` - the current status of a workflow run, including its
  final result payload once complete.
- `AgentRunOut` - execution details for a single agent's run within a
  workflow: agent name, status, duration in milliseconds, and retry count.
