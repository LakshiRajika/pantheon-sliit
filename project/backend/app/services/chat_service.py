"""Implements the shared chat runtime used by every role's AI assistant:
managing conversations, sending messages through the configured LLM, and
dispatching any tool calls the model requests.
"""

import json
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.assistants.registry import resolve_assistant
from app.assistants.tools import TOOL_REGISTRY
from app.core.exceptions import ForbiddenError, NotFoundError
from app.database.models import User
from app.llm.provider import get_llm
from app.permissions.resource_access import assert_can_access_conversation
from app.permissions.roles import RoleName
from app.repositories.chat_repo import ChatRepository
from app.safety.output_validator import strip_unsafe_text
from app.safety.safety_pipeline import sanitize_tool_result, sanitize_user_input

logger = logging.getLogger(__name__)

LLM_UNAVAILABLE_MESSAGE = (
    "The assistant is temporarily unavailable. Please try again shortly, "
    "or contact a colleague for anything urgent."
)


class ChatService:
    """One shared runtime for every role's assistant. Only the configuration,
    allowed tools, and retrieved context differ per role (section 15) - the
    client can never choose or override its assistant role in the payload;
    it is always resolved from the authenticated user.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ChatRepository(db)

    async def create_conversation(self, user: User, title: str | None):
        """Creates a new chat conversation bound to the user's own role,
        rejecting the Admin role since it has no assistant."""
        role = RoleName(user.role.name)
        if role == RoleName.ADMIN:
            raise ForbiddenError("The Administrator workspace has no chat assistant.")
        convo = await self.repo.create_conversation(user.id, role.value, title)
        await self.db.commit()
        return convo

    async def list_conversations(self, user: User):
        """Returns all conversations owned by the user."""
        return await self.repo.list_conversations(user.id)

    async def send_message(self, conversation_id: uuid.UUID, user: User, content: str) -> dict:
        """Handles one turn of a chat conversation: sanitizes and stores the
        user's message, resolves the role-specific assistant config, replays
        conversation history plus the system prompt to the LLM, sanitizes the
        model's reply, and - if the reply is a tool-call directive - dispatches
        it through `_run_tool` before storing and returning the final answer."""
        convo = await self.repo.get_conversation(conversation_id)
        if convo is None:
            raise NotFoundError("Conversation not found.")
        assert_can_access_conversation(convo.owner_id, user)

        clean_input = sanitize_user_input(content)
        await self.repo.add_message(conversation_id, "user", clean_input)

        role = RoleName(convo.assistant_role)
        config = resolve_assistant(role)

        history = await self.repo.list_messages(conversation_id)
        messages = [{"role": "system", "content": config.system_instructions}]
        messages += [{"role": m.role, "content": m.content} for m in history]

        try:
            llm = get_llm()
            response = await llm.ainvoke(messages)
            answer = strip_unsafe_text(response.content)

            # Minimal single-pass tool use: look for an explicit tool directive
            # the model was instructed to emit; a production build would use the
            # provider's native tool-calling interface instead of this pattern.
            if answer.strip().startswith("TOOL:"):
                answer = await self._run_tool(answer, config.allowed_tools, user)
        except Exception as exc:
            # Every configured provider failed (or none are configured at
            # all) - degrade gracefully instead of surfacing a raw 500, same
            # principle as the Risk agent's deterministic fallback.
            logger.warning("chat_service LLM call failed: %s", exc)
            answer = LLM_UNAVAILABLE_MESSAGE

        await self.repo.add_message(conversation_id, "assistant", answer)
        await self.db.commit()
        return {"role": "assistant", "content": answer}

    async def _run_tool(self, directive: str, allowed_tools: list[str], user: User) -> str:
        """Parses a "TOOL:name|{json args}" directive emitted by the model,
        rejects it if the tool isn't both in this role's allow-list and the
        global TOOL_REGISTRY, then invokes it and sanitizes its result before
        it is shown to the user."""
        try:
            _, rest = directive.split(":", 1)
            tool_name, arg_json = rest.split("|", 1) if "|" in rest else (rest.strip(), "{}")
            tool_name = tool_name.strip()
            args = json.loads(arg_json)
        except Exception:
            return "I could not process that request."

        if tool_name not in allowed_tools or tool_name not in TOOL_REGISTRY:
            return "That action is not available to your role."

        result = await TOOL_REGISTRY[tool_name](self.db, user, **args)
        return sanitize_tool_result(json.dumps(result))
