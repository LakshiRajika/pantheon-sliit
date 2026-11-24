"""Single LLM entry point used by every agent and chat assistant.

Fallback order, strictly: Groq -> Gemini -> OpenRouter. A LangChain
RunnableWithFallbacks tries the primary model and, only on an exception
(rate limit, timeout, auth error, provider outage), falls through to the
next provider in order. Callers never need to know which provider actually
answered a given call.
"""

import logging

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.runnables import RunnableWithFallbacks

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_cached_chain: RunnableWithFallbacks | None = None


def _build_groq() -> BaseChatModel | None:
    """Build a Groq chat model if a Groq API key is configured, otherwise return None."""
    settings = get_settings()
    if not settings.groq_api_key:
        return None
    from langchain_groq import ChatGroq

    return ChatGroq(model=settings.groq_model, api_key=settings.groq_api_key, temperature=0.1, timeout=30)


def _build_gemini() -> BaseChatModel | None:
    """Build a Gemini chat model if a Google API key is configured, otherwise return None."""
    settings = get_settings()
    if not settings.google_api_key:
        return None
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(model=settings.gemini_model, google_api_key=settings.google_api_key, temperature=0.1)


def _build_openrouter() -> BaseChatModel | None:
    """Build an OpenRouter-backed chat model if an OpenRouter API key is configured, otherwise return None."""
    settings = get_settings()
    if not settings.openrouter_api_key:
        return None
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=settings.openrouter_model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        temperature=0.1,
        timeout=30,
    )


def get_llm() -> RunnableWithFallbacks | BaseChatModel:
    """Returns a chat model that tries Groq, then Gemini, then OpenRouter.

    Raises RuntimeError at call time (not import time) if none of the three
    API keys are configured, so the app can still boot without LLM keys set
    (e.g. to exercise non-AI endpoints) and fail loudly only when an agent
    or chat assistant actually tries to call the model.
    """
    global _cached_chain
    if _cached_chain is not None:
        return _cached_chain

    candidates = []
    for name, builder in (("groq", _build_groq), ("gemini", _build_gemini), ("openrouter", _build_openrouter)):
        model = builder()
        if model is not None:
            candidates.append((name, model))
        else:
            logger.info("LLM provider '%s' skipped: no API key configured", name)

    if not candidates:
        raise RuntimeError(
            "No LLM provider configured. Set at least one of GROQ_API_KEY, "
            "GOOGLE_API_KEY, or OPENROUTER_API_KEY in .env."
        )

    primary_name, primary = candidates[0]
    fallbacks = [m for _, m in candidates[1:]]
    logger.info(
        "LLM fallback chain: primary=%s, fallbacks=%s",
        primary_name,
        [n for n, _ in candidates[1:]],
    )

    chain = primary.with_fallbacks(fallbacks) if fallbacks else primary
    _cached_chain = chain
    return chain
