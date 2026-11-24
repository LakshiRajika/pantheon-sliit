"""Request and response schemas for chat conversations and messages exchanged with the assistant."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import IdStr


class ConversationCreate(BaseModel):
    """Fields submitted when starting a new chat conversation."""

    title: str | None = None


class ConversationOut(BaseModel):
    """A chat conversation and its metadata."""

    id: IdStr
    assistant_role: str
    title: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    """A new message submitted to a conversation."""

    content: str


class MessageOut(BaseModel):
    """A single message within a conversation."""

    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
