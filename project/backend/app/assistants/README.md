# Assistants

This package implements the role-specific AI chat assistants used throughout
the system. There is no per-role chat engine — instead there is a single
shared chat runtime (`ChatService`, in `app/services/chat_service.py`) that
is parameterized per request by a small, declarative configuration object
looked up for the authenticated user's role. This directory holds that
configuration and the tool functions the assistants are allowed to call.

## Files

- `configs.py` — defines `AssistantConfig` (system prompt, allowed tool
  names, suggested questions) and the concrete config for each role: Customs
  Officer, Importer/Exporter, Management, Shipping Agent, and Port
  Operations.
- `registry.py` — maps `RoleName` to its `AssistantConfig` and exposes
  `resolve_assistant(role)`, the single lookup function the chat service
  uses to pick a configuration for a conversation.
- `tools.py` — the actual tool functions the model is permitted to invoke,
  plus the `TOOL_REGISTRY` dispatch table used to call them by name.

## One shared runtime, many configs

Every role talks to the same `ChatService` code path: the same LLM calling
convention, the same conversation storage, the same input/output
sanitization, the same tool-dispatch mechanism. What differs between roles
is purely data — the system prompt that frames what the assistant may
discuss, and the subset of tool names it's allowed to invoke. Adding or
adjusting a role's assistant behavior means editing its `AssistantConfig` in
`configs.py`, not writing new chat-handling code.

## Admin has no assistant, by design

`ASSISTANT_REGISTRY` in `registry.py` has no entry for `RoleName.ADMIN`.
This is intentional, not an oversight: Admin is an operational/system-management
role and was deliberately never given a chatbot. `resolve_assistant(RoleName.ADMIN)`
raises a `ValueError` rather than returning a config, and the chat service
itself rejects conversation creation for the Admin role before it would ever
reach that lookup.

## Tool availability is not the security boundary

Each `AssistantConfig.allowed_tools` list determines which tool *names* the
model is permitted to request for that role, and `ChatService._run_tool`
checks a requested tool name against both that allow-list and the global
`TOOL_REGISTRY` before dispatching it. That check only decides whether a
tool call is attempted at all — it is not where authorization to the
underlying data is enforced.

Every tool function in `tools.py` independently re-verifies that the calling
user is actually allowed to see the data it's about to return, regardless of
how it was invoked. For example, `get_shipment_details` loads the shipment
and then calls `assert_can_access_shipment(user, shipment)` before returning
anything — it does not assume that being on a role's allow-list already
proves ownership or visibility of that specific shipment. Functions scoped to
"the caller's own records" (`get_my_shipments`) query only data owned by or
visible to that user in the first place, rather than filtering a
cross-user result afterward. This means a bug in a config's allow-list, a
tool call issued through an unexpected path, or a future caller of these
functions outside the chat flow cannot bypass data-level authorization —
each tool enforces it on its own.
