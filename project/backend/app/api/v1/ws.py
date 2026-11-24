"""WebSocket endpoint for pushing real-time server-originated updates (e.g. workflow/review status changes) to authenticated clients."""

import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket.auth import authenticate_websocket
from app.websocket.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Authenticate the connecting client, register the socket with the connection manager, and keep it open until the client disconnects."""
    user = await authenticate_websocket(websocket)
    if user is None:
        await websocket.close(code=4401)
        return

    connection_id = str(uuid.uuid4())
    await manager.connect(connection_id, websocket, user)
    try:
        while True:
            await websocket.receive_text()  # client pings / keepalive; server is push-only
    except WebSocketDisconnect:
        manager.disconnect(connection_id)
