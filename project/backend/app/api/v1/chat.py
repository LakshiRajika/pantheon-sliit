"""Chat endpoints: creating conversations and exchanging messages with the assistant."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.database.models import User
from app.database.session import get_db
from app.permissions.permission_catalog import Permission
from app.schemas.chat import ConversationCreate, ConversationOut, MessageCreate, MessageOut
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/conversations", response_model=ConversationOut)
async def create_conversation(payload: ConversationCreate, user: User = Depends(require_permission(Permission.CHAT_USE)), db: AsyncSession = Depends(get_db)):
    """Create a new chat conversation for the current user. Requires the CHAT_USE permission."""
    service = ChatService(db)
    convo = await service.create_conversation(user, payload.title)
    return ConversationOut.model_validate(convo)


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(user: User = Depends(require_permission(Permission.CHAT_USE)), db: AsyncSession = Depends(get_db)):
    """List the current user's chat conversations. Requires the CHAT_USE permission."""
    service = ChatService(db)
    convos = await service.list_conversations(user)
    return [ConversationOut.model_validate(c) for c in convos]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageOut)
async def send_message(conversation_id: uuid.UUID, payload: MessageCreate, user: User = Depends(require_permission(Permission.CHAT_USE)), db: AsyncSession = Depends(get_db)):
    """Send a user message to a conversation and return the assistant's reply. Requires the CHAT_USE permission."""
    service = ChatService(db)
    result = await service.send_message(conversation_id, user, payload.content)
    return MessageOut(role=result["role"], content=result["content"], created_at=__import__("datetime").datetime.utcnow())
