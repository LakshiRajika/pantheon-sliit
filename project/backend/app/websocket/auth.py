"""Authenticates incoming WebSocket connections using a JWT passed as a query
parameter, since the WebSocket handshake can't carry custom headers.
"""

import uuid

from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decode_token
from app.database.models import User
from app.database.session import AsyncSessionLocal


async def authenticate_websocket(websocket: WebSocket) -> User | None:
    """Validates the connection's JWT and loads the corresponding active user,
    returning None if the token is missing, invalid, or the user is inactive.
    Reads the JWT from a query param since browsers can't set custom
    headers on a WebSocket handshake: ws://host/api/v1/ws?token=<jwt>."""
    token = websocket.query_params.get("token")
    if not token:
        return None
    try:
        payload = decode_token(token)
    except Exception:
        return None

    async with AsyncSessionLocal() as db:  # type: AsyncSession
        # Eager-load role: the returned user outlives this session (it's read
        # again later by ConnectionManager.broadcast, after this function's
        # session has closed), so role must already be loaded into memory.
        try:
            user_id = uuid.UUID(payload["sub"])
        except (KeyError, ValueError, TypeError):
            return None
        user = await db.get(User, user_id, options=[selectinload(User.role)])
        if user is None or not user.is_active:
            return None
        return user
