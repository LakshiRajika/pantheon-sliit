"""Tracks active WebSocket connections and broadcasts realtime events to them,
filtering each event by the connected user's role-based authorization.
"""

from fastapi import WebSocket

from app.database.models import User
from app.websocket.subscriptions import is_event_authorized


class ConnectionManager:
    """In-memory registry of open WebSocket connections keyed by connection id,
    each paired with the authenticated user that owns it."""

    def __init__(self):
        self._connections: dict[str, tuple[WebSocket, User]] = {}

    async def connect(self, connection_id: str, websocket: WebSocket, user: User) -> None:
        """Accepts the WebSocket handshake and registers the connection."""
        await websocket.accept()
        self._connections[connection_id] = (websocket, user)

    def disconnect(self, connection_id: str) -> None:
        """Removes a connection from the registry, if present."""
        self._connections.pop(connection_id, None)

    async def broadcast(self, event: dict) -> None:
        """Delivers only to connections whose user is authorized for this
        specific event (section 14) - connection auth alone is not enough."""
        event_name = event["event"]
        dead = []
        for conn_id, (ws, user) in self._connections.items():
            if not is_event_authorized(user, event_name):
                continue
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(conn_id)
        for conn_id in dead:
            self.disconnect(conn_id)


manager = ConnectionManager()
