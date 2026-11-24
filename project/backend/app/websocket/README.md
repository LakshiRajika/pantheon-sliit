# WebSocket

This package handles realtime push delivery over WebSocket connections:
authenticating a connecting client, tracking open connections in memory,
defining the catalog of events the system can emit, and deciding — per
connection, per event — whether a given event is actually allowed to reach
that connection.

## Files

- `auth.py` — `authenticate_websocket()`, which validates the JWT on an
  incoming WebSocket handshake and loads the corresponding user.
- `manager.py` — `ConnectionManager`, the in-memory registry of open
  connections, and the `broadcast()` entry point used to push events to them.
- `events.py` — `EventType`, the enum of every realtime event name the
  system can send, and `build_event()`, a helper that assembles a
  well-formed event payload.
- `subscriptions.py` — `ROLE_EVENT_SCOPES` and `is_event_authorized()`,
  which decide whether a connected user's role is allowed to receive a given
  event.

## Authentication: JWT as a query parameter

A browser's WebSocket handshake cannot carry custom headers, so there is no
way to attach a bearer token the way a normal HTTP request would.
`authenticate_websocket()` instead reads the token from a query parameter —
`ws://host/api/v1/ws?token=<jwt>` — decodes it, loads the corresponding
user, and returns `None` (causing the caller to refuse the connection) if
the token is missing, invalid, or the account is inactive.

## ConnectionManager: an in-memory connection registry

`ConnectionManager` holds a plain dict of `connection_id -> (websocket,
user)` for every currently open connection. `connect()` accepts the
handshake and registers the pair; `disconnect()` removes it. It is
intentionally simple and process-local — there is no cross-process or
cross-instance connection sharing. `broadcast()` is the single place events
are fanned out to connections, and if sending to a connection raises, that
connection is treated as dead and dropped from the registry.

## Event-level authorization is separate from connection authentication

Being an authenticated, registered connection does not mean a connection
receives every event. `ConnectionManager.broadcast()` calls
`is_event_authorized(user, event_name)` for every open connection before
sending, and skips delivery entirely if it returns `False`. This check is
driven by `ROLE_EVENT_SCOPES` in `subscriptions.py`, which maps each role to
the set of event-name prefixes it's allowed to see — for example, a Customs
Officer's scope includes `review.`, so review events reach them, while an
Importer/Exporter's scope is limited to `shipment.status`, so they receive
shipment status updates but never `review.*` or `workflow.*` events. This
means the set of events a given connection actually receives is
re-evaluated per event, per connection, and is not something decided once at
connect time.

## Why the role relationship must be eager-loaded here

`authenticate_websocket()` eager-loads `User.role` (via
`selectinload(User.role)`) before returning the user, in the same way
`get_current_user` (in `app/auth/dependencies.py`) does for ordinary HTTP
requests. For HTTP requests this matters because many call sites read
`user.role.name` after the dependency returns, outside the async session
that a lazy load would need.

For the WebSocket case the same constraint is sharper: the user object
returned by `authenticate_websocket()` is stored in `ConnectionManager` and
is read again much later, from `ConnectionManager.broadcast()`, whenever any
event is emitted — which can be long after this function's own database
session has already closed. `is_event_authorized()` accesses `user.role.name`
at that later point. If `role` had not been eagerly loaded into memory
during authentication, that later access would attempt a lazy load against a
database session that no longer exists and fail. Eager-loading at
authentication time is therefore not just an optimization but a correctness
requirement specific to how long-lived WebSocket connections keep their user
object around.
