"""ORM models for the conversational assistant interface: conversations, their messages, and tool calls made within them."""

import uuid

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ChatConversation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A chat thread between a user and the assistant, scoped to the role the user had when it was created."""

    __tablename__ = "chat_conversations"
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    assistant_role: Mapped[str] = mapped_column(String(50))  # resolved from owner's role at creation time
    title: Mapped[str | None] = mapped_column(String(200))

    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="conversation")


class ChatMessage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A single message (from the user or the assistant) within a chat conversation."""

    __tablename__ = "chat_messages"
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_conversations.id"))
    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text)  # PII-minimized before persistence
    safe_metadata: Mapped[dict] = mapped_column(JSON, default=dict)

    conversation: Mapped[ChatConversation] = relationship(back_populates="messages")


class ChatToolExecution(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A record of a tool invocation triggered by an assistant message, with its outcome."""

    __tablename__ = "chat_tool_executions"
    message_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_messages.id"))
    tool_name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(30))  # OK | DENIED | FAILED
    safe_result_reference: Mapped[str | None] = mapped_column(String(255))
