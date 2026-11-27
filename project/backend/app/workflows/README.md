# Workflows

This package defines and runs the core LangGraph workflow for processing a shipment through the port-logistics pipeline. It contains the shared state schema, the graph assembly, the conditional routing logic, and the Postgres-backed checkpointer that lets a run pause for human review and later resume.

## Node flow

```
tracking -> documentation -> congestion -> risk --(route_after_risk)--+--> scheduling -> finalize -> END
                                                                       |
                                                                       +--> escalation --(route_after_escalation)--+--> scheduling -> finalize -> END
                                                                                                                    +--> finalize -> END
```

The happy path runs straight through tracking, documentation, congestion, and risk. After risk classification, a conditional edge decides whether the shipment needs human review. If it does, the graph pauses at the escalation node until a reviewer responds; once resumed, a second conditional edge decides whether to continue into scheduling or skip straight to finalize.

## Shared state: `state.py`

`WorkflowState` is a `TypedDict` (all fields optional) that every node reads from and returns partial updates to. LangGraph merges each node's returned dict back into the shared state. It holds:

- **Identifiers**: `workflow_id`, `shipment_id`, `thread_id` (the LangGraph checkpoint thread id used to resume a paused run).
- **Input**: `shipment_context` (the input payload describing the shipment - vessel, cargo, etc.) and `document_references` (paths/ids of submitted documents).
- **Per-agent outputs**: `tracking_result`, `document_result`, `congestion_result`, `risk_result`, `scheduling_result` - each a dict produced by the corresponding agent node.
- **Human review fields**: `review_required` (set by the escalation agent), `review_request_id`, and `human_decision` (populated only after the paused workflow is resumed with the reviewer's response).
- **Bookkeeping**: `errors` (a list that nodes append to, merged via `operator.add` so concurrent/sequential writes accumulate rather than overwrite), `workflow_status` (`RUNNING | AWAITING_REVIEW | COMPLETED | FAILED`), and `final_result` (the combined output assembled at the end).

By design, the state is kept thin - raw documents and unredacted PII never flow through it. The Documentation Agent redacts before writing anything into `document_result`.

## Routing: `routing.py`

Two conditional-edge functions decide where the graph goes next.

**`route_after_risk(state)`** runs after the Risk & Inspection Agent. It escalates to a human (`"escalate"`) if any of the following hold, otherwise it proceeds straight to scheduling (`"scheduling"`):
- the risk classification's `risk_level` is `HIGH`,
- the risk classification's `confidence` is below `RISK_ESCALATION_THRESHOLD` (0.6),
- the documentation result's `status` is `INCONSISTENT`.

**`route_after_escalation(state)`** runs after the graph resumes from the human-review interrupt. It reads `human_decision.decision` and returns `"scheduling"` if the reviewer chose `APPROVE_RECOMMENDATION` or `REQUEST_INFORMATION`; any other decision (e.g. a rejection) returns `"end"`, sending the run straight to `finalize` without a scheduling recommendation.

## Postgres checkpointing: `checkpointing.py`

LangGraph needs a checkpointer to persist graph state across the pause/resume boundary created by `interrupt()`. This module wraps `AsyncPostgresSaver` from `langgraph.checkpoint.postgres.aio`:

- `init_checkpointer()` is called once during FastAPI lifespan startup. It builds a psycopg conninfo string from the application's `database_url` setting (stripping the `+psycopg` SQLAlchemy driver suffix, since the checkpointer manages its own psycopg connection pool independent of the app's SQLAlchemy engine), opens the connection via `AsyncPostgresSaver.from_conn_string(...)`, and calls `.setup()` to create LangGraph's own tables.
- `close_checkpointer()` is called once during shutdown to close that connection pool.
- `get_checkpointer()` returns the already-initialized singleton for use when compiling or invoking the graph, and raises if called before `init_checkpointer()`.

Importantly, LangGraph's checkpointer manages its own Postgres tables (`checkpoints`, `checkpoint_writes`, etc.) separately from the application's own SQLAlchemy-defined tables (such as the business-level `review_requests` record). Nothing here hand-rolls a replacement for those LangGraph tables - they live in the same Postgres instance but are a distinct concern from the application schema.

## Graph assembly: `graph.py`

`build_graph()` constructs the `StateGraph(WorkflowState)`:

1. Registers each of the six agent nodes: `tracking`, `documentation`, `congestion`, `risk`, `scheduling` (each wrapped with `_instrumented(...)`, see below), `escalation` (wrapped as `escalation_node`), plus a `finalize` node.
2. Wires straight-line edges: `tracking -> documentation -> congestion -> risk`.
3. Adds the conditional edge out of `risk` using `route_after_risk`, mapping `"escalate" -> escalation` and `"scheduling" -> scheduling`.
4. Adds the conditional edge out of `escalation` using `route_after_escalation`, mapping `"scheduling" -> scheduling` and `"end" -> finalize`.
5. Wires `scheduling -> finalize -> END`.

`get_compiled_graph(checkpointer)` compiles the graph once per checkpointer instance and caches it module-level, since compiling is not free and the graph definition itself is stateless.

### `_instrumented(agent_name, agent_fn)`: AgentRun/AgentResult persistence

Graph nodes run outside any request-scoped database session, so each call of this wrapper opens its own dedicated `AsyncSessionLocal()` session to record what happened - this is what actually populates the Admin "Agent Runs" page, not just an internal implementation detail. Before calling the wrapped agent it creates an `AgentRun` row (`WorkflowRepository.start_agent_run`) and commits; after the call it records either `finish_agent_run("COMPLETED", output, duration_ms)` or, if the agent raised, `fail_agent_run(run, duration_ms, "AGENT_ERROR")`, re-raising the original exception either way. Every one of these bookkeeping steps is wrapped in its own try/except that only logs a warning on failure - persistence bugs here must never be able to fail or mask the actual workflow run.

It is applied to the five nodes that run in a straight line - `tracking`, `documentation`, `congestion`, `risk`, `scheduling` - via `_instrumented("tracking_agent", tracking_agent)` etc. in `build_graph()`. `escalation_node` is deliberately left unwrapped: it calls LangGraph's `interrupt()`, and wrapping that in this wrapper's generic try/except would risk mishandling the control-flow signal `interrupt()` uses to pause the graph.

When the wrapped agent is `tracking_agent`, `_instrumented` additionally calls `_record_vessel_position(tracking_result)` on its output before recording completion.

### `_record_vessel_position(tracking_result)`

Called from inside the tracking node's instrumented wrapper. Upserts a `Vessel` row by name (shipment creation doesn't yet collect/link a real vessel, so there's no real IMO number to match on - a synthetic one is minted as `imo_number=f"SIM{uuid4().hex[:9].upper()}"` when a new vessel row is created) and inserts a new `VesselPosition` row from the tracking result's simulated lat/lon, speed, ETA, and data source. This is what populates the Vessels workspace/tracking views with real rows instead of only ever showing the transient per-run simulator output. Like the rest of `_instrumented`, failures here are logged and swallowed rather than propagated - this is a secondary record of data the workflow already produced, never something the pipeline itself depends on.

### `escalation_node`

This is the node that makes the pause real. It first calls `escalation_agent(state)` to mint a `review_request_id` and mark `review_required`/`workflow_status`. It then calls LangGraph's `interrupt(...)`, passing a payload with the review request id, shipment id, and a reason string. `interrupt()` genuinely suspends graph execution at this point - it is not merely setting a status flag and letting the graph continue. The graph run stops here, and its state (including everything accumulated so far) is checkpointed to Postgres via the checkpointer.

Execution resumes only when something later invokes the graph again with a `Command(resume=<reviewer's decision>)` against the same thread id. At that point, the value passed to `resume` becomes the return value of the `interrupt()` call inside `escalation_node`, which is written into state as `human_decision`, and `workflow_status` is reset to `RUNNING`. The graph then evaluates `route_after_escalation` to decide whether to continue to scheduling or go straight to finalize.

### `finalize_node`

Assembles the combined output of all agent nodes (`tracking`, `document`, `congestion`, `risk`, `scheduling`, plus `human_decision` if present) into `final_result`, and sets `workflow_status` to `COMPLETED`.
