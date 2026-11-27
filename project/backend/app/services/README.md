# Services

This package holds the business-logic layer that sits between the API
routers and the database/workflow engine. Each service coordinates one area
of functionality: translating a request into repository calls, enforcing
access rules, and — where relevant — triggering workflow runs or realtime
events. Routers stay thin; the logic that decides *what* happens and *who
is allowed to see it* lives here.

## ShipmentService (`shipment_service.py`)

Coordinates shipment creation and lookup. `create()` persists a new
shipment (owned by the submitting shipping agent) and records a
`SHIPMENT_CREATED` timeline event. `get_authorized()` loads a shipment and
calls `assert_can_access_shipment()` before returning it, raising
`NotFoundError` if it doesn't exist. `list_for_user()` returns either every
shipment (for oversight/operations roles: Customs Officer, Port Operations,
Management, Admin) or only the user's own, depending on role. `timeline()`
returns a shipment's event history, gated by the same authorization check.

## DocumentService (`document_service.py`)

Coordinates document upload and retrieval for a shipment. `upload()` checks
that the shipment exists and that the caller can access it, validates the
upload (filename, MIME type, size against the configured maximum) via
`validate_upload()`, saves the file to storage, and records it through the
document repository. `list_for_shipment()` applies the same existence and
access checks before returning a shipment's attached documents.

## ReviewService (`review_service.py`)

Manages the human-review gate. `queue()` returns all pending reviews.
`decide()` records an officer's decision on a review (rejecting it with
`ConflictError` if it was already resolved), broadcasts a
`REVIEW_COMPLETED` event, and then resumes the associated workflow's
LangGraph run via `WorkflowService.resume()`, passing the officer's
decision and comments back into the paused graph.

## TrackingService (`tracking_service.py`)

Simple read-only queries backing vessel tracking: `list_vessels()` returns
all known vessels, and `positions()` returns a vessel's 50 most recent
recorded positions, newest first.

## AnalyticsService (`analytics_service.py`)

Computes aggregate operational KPIs for the Management dashboard: total
shipment count, counts grouped by status and by risk level, and total
workflow runs. Deliberately returns only aggregate, anonymized figures —
raw per-case evidence belongs to the Customs/review views, not this
service.

## AdminService (`admin_service.py`)

Backs the Admin workspace: listing and creating users, reassigning a user's
role, activating/deactivating an account, reading recent audit log entries,
listing recent agent runs, summarizing workflow counts by status, and a
health check.

- `create_user(email, full_name, password, role_name)` creates a new account,
  raising `ConflictError` if the email is already registered or
  `ValidationFailedError` if the role name doesn't exist - the same checks
  the self-service registration endpoint applies, since an admin creating an
  account on someone else's behalf is the same underlying operation.
- `set_role(user_id, role_name)` and `set_status(user_id, is_active)` take
  raw ids, raise `NotFoundError` if the user doesn't exist, and both return a
  freshly-fetched `User` rather than the mutated instance. `set_role`
  specifically calls `self.db.expire(user, ["role"])` after commit: since the
  session doesn't expire attributes on commit (`expire_on_commit=False`), the
  already-loaded `role` relationship would otherwise keep pointing at the old
  role even after `role_id` has changed and been committed.
- `health()` checks database connectivity, and also reports `llm_providers`
  (`ok`/`not_configured` based on whether any LLM provider API key is set -
  never a real, billed call to a provider just to render a status dot) and
  `document_storage` (`ok`/`unavailable` based on whether the upload
  directory exists and is writable).

## WorkflowService (`workflow_service.py`)

Starts and resumes the LangGraph shipment-processing workflow, and is the
service most entangled with the system's async and state-management
design:

- **Submission returns immediately.** `start()` creates a workflow row and
  then dispatches the actual graph run as a background asyncio task
  (`asyncio.create_task(self._run_graph(...))`) rather than awaiting it.
  The caller — shipment submission — gets back a `workflow_id` right away
  without blocking on every agent in the graph executing. It first rejects
  the request outright with a `ValidationFailedError` (-> HTTP 422) if no
  documents have been uploaded yet — the Documentation Agent already has a
  defined behavior for a missing document (it flags `MISSING_FIELDS`, which
  escalates to human review), but running an entire agent pipeline just to
  reach that already-knowable conclusion wastes a full workflow run.
- **Escalation snapshots upstream context onto the review row.**
  `_handle_graph_outcome()` is the one moment the tracking/document/
  congestion/risk results produced so far are available anywhere outside
  LangGraph's own opaque checkpoint. When the graph interrupts, it captures
  those four results into a `context_snapshot` dict and stores it on the
  created `ReviewRequest` row, since nothing else persists that upstream
  state for the reviewer to see while the review is pending.
- **The LangGraph checkpoint is not the review queue.** The graph run uses
  its own LangGraph checkpointer (`get_checkpointer()`), keyed by
  `thread_id`, to persist and resume execution state. That checkpoint is a
  mechanism for pausing/resuming the graph itself — it is entirely separate
  from the business-level `review_requests` row that `_handle_graph_outcome()`
  creates when the graph interrupts (via the escalation node's
  `interrupt()` call). The checkpoint says "this graph is paused here and
  can be resumed"; the review row says "a human needs to make a decision,
  and here's why." Neither is derived from or substitutes for the other:
  the workflow can be marked `AWAITING_REVIEW` with a pending review row
  while the checkpoint independently holds the exact point to resume from.
- **Resuming replays from the checkpoint, not from scratch.** `resume()`
  takes a human reviewer's decision and injects it into the paused graph
  with `graph.ainvoke(Command(resume=human_decision), config=...)`,
  continuing execution from the exact point it was interrupted rather than
  re-running upstream agents.
- Background execution means `_handle_graph_outcome()` and `_mark_failed()`
  open their own fresh database session (`AsyncSessionLocal()`) rather than
  reusing the service's, since they run detached from the request that
  started them. Both success and failure outcomes broadcast a
  corresponding WebSocket event (`WORKFLOW_COMPLETED`, `WORKFLOW_FAILED`,
  `REVIEW_CREATED`) so connected clients see progress without polling.

## ChatService (`chat_service.py`)

Implements the single shared chat runtime used by every role's assistant
(see `app/assistants/README.md` for the per-role configuration side of
this). Responsibilities:

- **Resolves the role-specific assistant.** A conversation is permanently
  bound to the owning user's role at creation time (`create_conversation`
  rejects Admin, which has no assistant). `send_message()` always resolves
  the assistant configuration from that stored role via
  `resolve_assistant()` — the client has no way to choose or override which
  assistant persona handles a conversation.
- **Sanitizes input and output.** User input is cleaned with
  `sanitize_user_input()` before being stored or sent to the model; the
  model's reply is passed through `strip_unsafe_text()`; and any tool
  result returned to the model/user is sanitized with
  `sanitize_tool_result()` before being shown.
- **Dispatches tool calls through an allow-list and a registry.** The
  current implementation looks for a `TOOL:name|{json}` directive in the
  model's reply (a stand-in for native provider tool-calling) and, before
  invoking anything, checks the requested tool name against both the role's
  `allowed_tools` and the global `TOOL_REGISTRY` — rejecting it if either
  check fails.
- **Degrades gracefully instead of failing with a 500.** If the LLM call
  raises — because every configured provider is down, misconfigured, or
  none are configured at all — `send_message()` catches the exception,
  logs a warning, and substitutes a fixed `LLM_UNAVAILABLE_MESSAGE`
  ("The assistant is temporarily unavailable...") as the assistant's reply
  rather than letting the error propagate to the caller. The conversation
  still records this fallback message like any other assistant turn, so
  the chat experience stays intact even when the LLM backend is entirely
  unavailable.
