"""Data access for chat conversations and their messages."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import ChatConversation, ChatMessage


class ChatRepository:
    """Async CRUD and query operations for ChatConversation and ChatMessage records."""

    def __init__(self, db: AsyncSession):
        """Stores the database session used for all queries issued by this repository."""
        self.db = db

    async def create_conversation(self, owner_id: uuid.UUID, assistant_role: str, title: str | None) -> ChatConversation:
        """Creates and persists a new chat conversation for the given owner."""
        convo = ChatConversation(owner_id=owner_id, assistant_role=assistant_role, title=title)
        self.db.add(convo)
        await self.db.flush()
        return convo

    async def get_conversation(self, conversation_id: uuid.UUID) -> ChatConversation | None:
        """Fetches a conversation by ID, or None if not found."""
        return await self.db.get(ChatConversation, conversation_id)

    async def list_conversations(self, owner_id: uuid.UUID) -> list[ChatConversation]:
        """Lists a user's conversations, newest first."""
        result = await self.db.execute(
            select(ChatConversation).where(ChatConversation.owner_id == owner_id).order_by(ChatConversation.created_at.desc())
        )
        return list(result.scalars().all())

    async def add_message(self, conversation_id: uuid.UUID, role: str, content: str) -> ChatMessage:
        """Appends a new message to a conversation."""
        message = ChatMessage(conversation_id=conversation_id, role=role, content=content)
        self.db.add(message)
        await self.db.flush()
        return message

    async def list_messages(self, conversation_id: uuid.UUID) -> list[ChatMessage]:
        """Lists a conversation's messages in chronological order."""
        result = await self.db.execute(
            select(ChatMessage).where(ChatMessage.conversation_id == conversation_id).order_by(ChatMessage.created_at)
        )
        return list(result.scalars().all())
