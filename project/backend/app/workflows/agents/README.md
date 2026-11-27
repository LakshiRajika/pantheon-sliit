# Agents

This package contains the six node implementations that make up the workflow graph. Each agent is an async function that takes the shared `WorkflowState` and returns a partial dict of updates, which LangGraph merges back into state. Four of the six are deterministic ingestion/forecast/rule-based nodes with no LLM involved; only the Risk & Inspection agent calls an LLM, and even then it has a deterministic fallback.

## Tracking Agent (`tracking_agent.py`)

- **Input**: `shipment_context` (for the vessel name).
- **Output**: `tracking_result` - vessel name, simulated lat/lon position, speed in knots, an ETA, an `eta_confidence` score, and a `data_source` marker.
- **LLM**: No. This is a plain data-ingestion node. In production it would poll a live AIS provider; here it falls back to a disclosed simulator calibrated around plausible Colombo-approach ETAs (`data_source: "simulator"`), never presented as real tracking data.
- **Side effect**: this is the one agent whose output also gets persisted as a standing record, not just returned into graph state. The graph's `_instrumented` wrapper (see `../README.md`) calls `_record_vessel_position()` on this agent's `tracking_result`, which upserts a `Vessel` row (by name, with a synthetic `SIM...` IMO number) and inserts a `VesselPosition` row - this is what backs the Vessels workspace.

## Documentation Agent (`documentation_agent.py`)

- **Input**: `document_references` (a list of document paths/ids).
- **Output**: `document_result` - a `status` (`COMPLETE`, `INCONSISTENT`, or `MISSING_FIELDS`), the merged `extracted_fields` across all submitted documents, and a `prompt_injection_flagged` boolean.
- **LLM**: No. This agent runs deterministic extraction and validation for each referenced document: it reads the raw file bytes, extracts raw text, screens that text for prompt-injection attempts (`screen_for_injection`), and extracts structured fields (bill-of-lading number, container number, certificate numbers, etc.) via `extract_structured_fields`.
- **Important detail**: structured fields are extracted from the *raw* (not redacted) document text, not from a PII-redacted version. Document reference numbers such as bill-of-lading numbers are not personal data, but several of them happen to match the PII redactor's broad passport-number pattern (e.g. two letters followed by six digits) and would otherwise be pseudonymized away before extraction ever saw them. Redaction still runs on the document elsewhere in the system - it is simply not applied before field extraction, since nothing from the free-text body is kept in this agent's output. Each document's fields are validated against bill-of-lading requirements via `validate_fields`, and the worst status across all documents wins. If no documents were submitted at all, the agent short-circuits and returns `status: "MISSING_FIELDS"` immediately.

## Congestion Agent (`congestion_agent.py`)

- **Input**: `tracking_result` (specifically `eta_confidence`).
- **Output**: `congestion_result` - a `berth_or_terminal` identifier, a `congestion_score`, a `forecast_window_hours`, a derived `confidence`, and a `data_source` marker.
- **LLM**: No. This is a forecasting node that combines the live tracking signal with a historical baseline. The baseline is a disclosed simulator calibrated against public SLPA/World Bank LPI figures, not a live SLPA feed (`data_source: "simulator_calibrated_to_public_stats"`).

## Risk & Inspection Agent (`risk_agent.py`)

- **Input**: `document_result` (status, injection flag) and `tracking_result` (ETA confidence), summarized into a compact `signal_summary`.
- **Output**: `risk_result` - `risk_level` (`LOW|MEDIUM|HIGH`), `confidence` (0.0-1.0), `recommendation` (`PROCEED|FLAG_FOR_INSPECTION`), and a one-sentence `rationale`.
- **LLM**: Yes. This is the one agent in the pipeline that calls an LLM, obtained via `app.llm.provider.get_llm()`. The upstream signal summary is wrapped as untrusted input (`wrap_as_untrusted`) before being sent as the user message, and the system prompt instructs the model to reason only over structured upstream signals - it never sees raw personal data and never makes a final clearance decision, only a recommendation a human customs officer may act on. The LLM's JSON response is parsed and validated against the `RiskClassification` pydantic schema via `validate_structured_output`.
- **Fallback**: if the LLM call fails for any reason (e.g. every provider is unavailable), the agent falls back to a deterministic rule rather than failing the whole pipeline. The fallback treats a document `status` of **either** `INCONSISTENT` **or** `MISSING_FIELDS` as warranting inspection - not just outright inconsistency - since an incomplete declaration is itself a risk signal. In that case it returns `HIGH`/`FLAG_FOR_INSPECTION` with confidence 0.5; otherwise `LOW`/`PROCEED` with confidence 0.9.

## Scheduling Agent (`scheduling_agent.py`)

- **Input**: `congestion_result` (congestion score and default berth) and `risk_result` (inspection recommendation).
- **Output**: `scheduling_result` - a `recommended_berth`, a `reserves_inspection_slot` boolean, and a `rationale` string.
- **LLM**: No. This is a deterministic recommendation node: it reserves an inspection slot when the risk agent recommended `FLAG_FOR_INSPECTION`, and reroutes to a secondary berth (`JCT-02`) when the congestion score exceeds 0.6, otherwise keeping the congestion agent's suggested berth. It does not execute a schedule - only produces a recommendation, which remains subject to downstream human review for consequential cases.

## Escalation Agent (`escalation_agent.py`)

- **Input**: none beyond the ambient state (it doesn't read upstream results directly).
- **Output**: `review_required: True`, a freshly minted `review_request_id` (UUID), and `workflow_status: "AWAITING_REVIEW"`.
- **LLM**: No. This agent itself only marks the state as needing human review and mints the tracking id; it does not perform the actual pause. The graph-level pause (via LangGraph's `interrupt()`) and the corresponding PostgreSQL `review_requests` row are created by the surrounding `escalation_node` (in `graph.py`) and the `WorkflowService` around graph execution, respectively. This keeps the business-level review record and the graph-level checkpoint as two separate, explicitly linked concerns.
