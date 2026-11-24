# LLM

This directory is the single entry point every agent and chat assistant in the backend uses to obtain an LLM client. It isolates provider selection and failover so callers never need to know (or care) which underlying provider actually answered a given call.

## Files

- **`provider.py`** — Contains `get_llm()`, which returns a LangChain chat model wired with a fallback chain. Three private builder functions (`_build_groq`, `_build_gemini`, `_build_openrouter`) each construct a `BaseChatModel` only if the corresponding API key is configured in settings (`groq_api_key`, `google_api_key`, `openrouter_api_key`), returning `None` otherwise:
  - **Groq** — `ChatGroq` with model `openai/gpt-oss-120b` (configurable via `groq_model`), temperature 0.1, 30s timeout.
  - **Gemini** — `ChatGoogleGenerativeAI` with model `gemini-flash-latest` (configurable via `gemini_model`), temperature 0.1.
  - **OpenRouter** — `ChatOpenAI` pointed at OpenRouter's base URL, model `openrouter/free` (configurable via `openrouter_model`), temperature 0.1, 30s timeout.

  `get_llm()` builds the list of configured providers in strict order (Groq, then Gemini, then OpenRouter), logging which ones were skipped for missing keys. If none are configured it raises `RuntimeError` — deliberately only at call time, not at import time, so the app can still boot and serve non-AI endpoints without any LLM key set, failing loudly only when something actually tries to invoke the model. The first configured provider becomes primary; the rest become fallbacks, combined via LangChain's `RunnableWithFallbacks` (`primary.with_fallbacks(fallbacks)`). The resulting chain is cached in a module-level `_cached_chain` so it's built once per process.

## How the pieces relate

There's a single file here, so the "architecture" is really the fallback chain's shape: `RunnableWithFallbacks` tries the primary model first and only falls through to the next provider in order on an exception — rate limit, timeout, auth error, or provider outage. This means a transient Groq failure transparently retries on Gemini, then OpenRouter, without the caller (an agent or chat handler elsewhere in the app) ever seeing which provider responded. Configuration for all three providers (keys, model names, OpenRouter's base URL) comes from `app.core.config.Settings`, so this module has no configuration logic of its own — it only decides which of the already-configured providers to instantiate and in what order to chain them.
