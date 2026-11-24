# app/api/v1

This package holds the versioned HTTP and WebSocket route definitions — the actual API surface of the backend. Every router here is aggregated by `app/api/router.py` and mounted under the `/api/v1` prefix by `app/main.py` (the WebSocket router is the one exception that isn't prefixed with a resource path of its own).

Authorization on each endpoint is enforced through two FastAPI dependencies from `app.auth.dependencies`:

- `get_current_user` — requires a valid access token, but no specific permission.
- `require_permission(Permission.X)` — requires a valid access token **and** that the resolved role has permission `X`, as defined in `app/permissions/policy.py`.

The table below summarizes every endpoint. "Auth only" means the endpoint only requires `get_current_user` (any authenticated user, regardless of role/permissions). Entity-level checks performed inside service methods (e.g. "can this user see this specific shipment") are not shown here since they aren't visible at the dependency level.

| Method | Path | Permission |
|---|---|---|
| POST | `/auth/register` | none (public) |
| POST | `/auth/login` | none (public) |
| GET | `/auth/me` | auth only |
| GET | `/users/me` | auth only |
| POST | `/shipments` | `SHIPMENT_CREATE` |
| GET | `/shipments` | auth only |
| GET | `/shipments/{shipment_id}` | auth only |
| GET | `/shipments/{shipment_id}/timeline` | auth only |
| POST | `/shipments/{shipment_id}/documents` | `DOCUMENT_UPLOAD` |
| GET | `/shipments/{shipment_id}/documents` | auth only |
| POST | `/shipments/{shipment_id}/workflow` | `WORKFLOW_START` |
| GET | `/workflows/{workflow_id}` | auth only |
| GET | `/workflows/{workflow_id}/agents` | auth only |
| GET | `/reviews/queue` | `REVIEW_QUEUE_READ` |
| GET | `/reviews/{review_id}` | `REVIEW_QUEUE_READ` |
| POST | `/reviews/{review_id}/decision` | `REVIEW_DECIDE` |
| GET | `/vessels` | `TRACKING_READ` |
| GET | `/vessels/{vessel_id}/positions` | `TRACKING_READ` |
| GET | `/analytics/dashboard` | `ANALYTICS_READ_AGGREGATE` |
| POST | `/chat/conversations` | `CHAT_USE` |
| GET | `/chat/conversations` | `CHAT_USE` |
| POST | `/chat/conversations/{conversation_id}/messages` | `CHAT_USE` |
| GET | `/admin/health` | `ADMIN_SYSTEM_READ` |
| GET | `/admin/users` | `ADMIN_USERS_MANAGE` |
| GET | `/admin/audit` | `ADMIN_AUDIT_READ` |
| GET | `/admin/agent-runs` | `ADMIN_SYSTEM_READ` |
| GET | `/admin/workflows` | `ADMIN_SYSTEM_READ` |
| WS | `/ws` | token-authenticated on connect |

## auth.py — `/auth`

No router-level permission requirement; these endpoints establish identity.

- `POST /auth/register` — creates a new user for a given role name, rejecting duplicate emails or unknown roles, and returns an access token.
- `POST /auth/login` — verifies email/password, records a `LoginEvent` (success or failure) regardless of outcome, and returns an access token on success.
- `GET /auth/me` (auth only) — returns the current user's profile plus their resolved permission set via `get_user_permissions`.

## users.py — `/users`

- `GET /users/me` (auth only) — returns the authenticated user's own profile (id, email, full name, role, active flag). Distinct from `/auth/me` in that it doesn't include the permission list.

## shipments.py — `/shipments`

- `POST /shipments` — requires `SHIPMENT_CREATE`. Creates a shipment owned by the current user.
- `GET /shipments` (auth only) — lists shipments visible to the current user (visibility rules are applied inside `ShipmentService.list_for_user`).
- `GET /shipments/{shipment_id}` (auth only) — fetches one shipment after an authorization check inside `ShipmentService.get_authorized`.
- `GET /shipments/{shipment_id}/timeline` (auth only) — returns the ordered event history for a shipment.

## documents.py

Paths are nested under `/shipments/{shipment_id}/documents` (no router-level prefix of its own).

- `POST /shipments/{shipment_id}/documents` — requires `DOCUMENT_UPLOAD`. Accepts a multipart file plus a `document_type` form field, reads the file bytes, and stores the document via `DocumentService.upload`.
- `GET /shipments/{shipment_id}/documents` (auth only) — lists documents attached to a shipment.

## workflows.py

Paths are split across `/shipments/{shipment_id}/workflow` and `/workflows/{workflow_id}` (no router-level prefix).

- `POST /shipments/{shipment_id}/workflow` — requires `WORKFLOW_START`. Looks up the shipment (authorized), gathers its uploaded documents' storage paths, and starts the LangGraph workflow via `WorkflowService.start`.
- `GET /workflows/{workflow_id}` (auth only) — returns workflow status and final result, or 404 if not found.
- `GET /workflows/{workflow_id}/agents` (auth only) — lists the individual agent runs (name, status, duration, retry count) for a workflow.

## reviews.py — `/reviews`

- `GET /reviews/queue` — requires `REVIEW_QUEUE_READ`. Lists items pending human review.
- `GET /reviews/{review_id}` — requires `REVIEW_QUEUE_READ`. Fetches a single review item or 404s.
- `POST /reviews/{review_id}/decision` — requires `REVIEW_DECIDE`. Records an accept/reject decision with optional comments and resumes the underlying workflow, returning its final result.

## tracking.py

No router-level prefix; both endpoints require `TRACKING_READ`.

- `GET /vessels` — lists tracked vessels (id, IMO number, name).
- `GET /vessels/{vessel_id}/positions` — returns recorded position history (lat/lon, source, timestamp) for a vessel.

## analytics.py — `/analytics`

- `GET /analytics/dashboard` — requires `ANALYTICS_READ_AGGREGATE`. Returns aggregate dashboard metrics across shipments and workflows.

## chat.py — `/chat`

All three endpoints require `CHAT_USE`.

- `POST /chat/conversations` — creates a new conversation for the current user.
- `GET /chat/conversations` — lists the current user's conversations.
- `POST /chat/conversations/{conversation_id}/messages` — sends a user message and returns the assistant's reply.

## admin.py — `/admin`

- `GET /admin/health` — requires `ADMIN_SYSTEM_READ`. Returns system health information.
- `GET /admin/users` — requires `ADMIN_USERS_MANAGE`. Lists all user accounts.
- `GET /admin/audit` — requires `ADMIN_AUDIT_READ`. Returns the audit log of actor actions and outcomes.
- `GET /admin/agent-runs` — requires `ADMIN_SYSTEM_READ`. Lists recent agent runs with status, duration, and retries.
- `GET /admin/workflows` — requires `ADMIN_SYSTEM_READ`. Returns a monitoring view of active and recent workflows.

## ws.py — `/ws`

Not permission-gated through `require_permission`; instead the single `WS /ws` endpoint calls `authenticate_websocket` to validate the connection's token before accepting it (closing with code 4401 if authentication fails). Once connected, the socket is registered with the global connection `manager` and is push-only from the server's side — the endpoint loop just drains client pings/keepalive frames until disconnect. Real-time events (e.g. workflow or review status changes) are pushed to the client out-of-band by other parts of the system through `app.websocket.manager`.
