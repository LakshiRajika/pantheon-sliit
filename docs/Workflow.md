# Workflow

This document covers the project's process flow and implementation
approach: the agent state graph, the dependency chain between agents,
conditional routing, checkpointer/human-in-the-loop behavior, and the
staged build order. For objectives, features, tech stack, and other
project details, see [PROJECT_DETAILS.md](PROJECT_DETAILS.md).

## 1. System Overview

The system is a single LangGraph `StateGraph`, checkpointed, with six
agents operating over a shared state object. Each agent reads the parts of
state it needs, performs its task (an LLM call, a model inference, a rules
pass, or a combination), and writes validated updates back to state before
the graph routes to the next node. PostgreSQL backs the checkpointer and
also stores the durable record of every shipment, every agent decision, and
the audit trail of human interventions.

```
                 ┌────────────────────┐
                 │   Tracking Agent    │──┐
                 └────────────────────┘  │
                                          ▼
                              ┌───────────────────────────┐
                              │ Congestion Prediction Agent │──┐
                              └───────────────────────────┘  │
                                                              ▼
┌────────────────────┐                          ┌─────────────────────────────┐
│ Documentation Agent │──┐                       │ Scheduling & Coordination    │──► ┌───────────────────────────────┐
└────────────────────┘  │                        │ Agent                        │    │ Escalation & Human Oversight   │──► Final decision
                         ▼                        └─────────────────────────────┘    │ Agent (checkpoint / pause gate) │
              ┌─────────────────────────────┐                  ▲                     └───────────────────────────────┘
              │ Risk & Inspection Routing    │──────────────────┘
              │ Agent                        │
              └─────────────────────────────┘
```

Tracking and Documentation are the two ingestion agents and run
independently of each other. Their outputs are consumed by two
mid-pipeline agents (Congestion Prediction and Risk & Inspection Routing),
which also run independently of each other before converging on
Scheduling & Coordination. Everything terminates at Escalation & Human
Oversight, which is the only node permitted to finalize a consequential
outcome.

## 2. Agent Design and Dependency Chain

### 2.1 Tracking Agent
- **Input:** Live AIS vessel position, speed, and ETA data.
- **Output:** Normalized vessel state (position, heading, speed, ETA
  confidence interval) written to shared state, keyed by vessel/voyage ID.
- **Notes:** Treated as a near-real-time polling/streaming ingestion node
  rather than an LLM-driven reasoning step.

### 2.2 Documentation Agent
- **Input:** Submitted trade documents (bills of lading, commercial
  invoices, certificates of origin).
- **Output:** Structured, extracted document fields, a validation status
  (complete / missing fields / inconsistent declarations), and a
  redacted copy of the document content for downstream agents.
- **Guardrails:**
  - **PII redaction** is applied to extracted text before it is written to
    shared state or passed to any other agent.
  - **Prompt-injection guardrails** screen document content for embedded
    instructions before it reaches any LLM-driven downstream agent,
    since trade documents are an adversarial input channel (externally
    supplied, not authored by a trusted party).

### 2.3 Congestion Prediction Agent
- **Input:** Normalized tracking state from the Tracking Agent, plus
  historical/aggregate berth utilization statistics.
- **Output:** A forecasted congestion window per berth/terminal, with a
  confidence score.
- **Notes:** Combines a live signal (current vessel positions/ETAs) with a
  statistical baseline (historical arrival and dwell patterns) to produce
  a forward-looking estimate rather than a reactive one.

### 2.4 Risk and Inspection Routing Agent
- **Input:** Validated/structured documentation state from the
  Documentation Agent.
- **Output:** A risk classification per shipment (e.g., low / medium /
  high) and a routing recommendation: proceed, or flag for manual
  inspection.
- **Notes:** This is the agent most directly aimed at the staffing
  shortage problem — its job is to concentrate scarce officer attention on
  the shipments where it is actually warranted.

### 2.5 Scheduling and Coordination Agent
- **Input:** Congestion forecast (2.3) and risk/inspection routing output
  (2.4).
- **Output:** A recommended berth/resource allocation plan that accounts
  for both expected congestion and which shipments will need inspection
  slots.
- **Notes:** This agent does not execute a schedule — it produces a
  recommendation that is still subject to human review downstream.

### 2.6 Escalation and Human Oversight Agent
- **Input:** The full upstream state: tracking, documentation, risk
  classification, congestion forecast, and scheduling recommendation.
- **Behavior:** Evaluates confidence and risk thresholds across upstream
  outputs. If everything is within normal bounds, the recommendation can
  proceed. If anything is ambiguous, high-risk, or low-confidence, the
  graph **pauses** at this node via the checkpointer, and the case is
  surfaced to a human officer in the Customs or SLPA review queue.
- **Resumption:** Once an officer approves, rejects, or amends the case,
  execution resumes from the exact checkpointed state — no upstream agent
  re-runs, and the officer's decision plus justification is written to the
  PostgreSQL audit trail.

## 3. Conditional Routing

Routing between agents is conditional on the content of shared state, not
fixed at graph-definition time. The main conditional edges are:

- **Documentation Agent → Risk & Inspection Routing Agent**: only proceeds
  once document validation status is resolved (complete, or explicitly
  flagged incomplete/inconsistent — both are valid terminal states for
  this edge, but they carry different payloads forward).
- **Risk & Inspection Routing Agent → Scheduling & Coordination Agent**:
  all shipments proceed to scheduling, but carry their risk classification
  forward so scheduling can reserve inspection capacity.
- **Scheduling & Coordination Agent → Escalation & Human Oversight Agent**:
  always routes here — this is the mandatory human-in-the-loop gate, not a
  conditional branch.
- **Escalation & Human Oversight Agent → end / resume**: conditional on
  officer action. A pending case halts graph execution at the checkpoint;
  an officer decision resumes it toward a finalized outcome.

## 4. Checkpointer & Human-in-the-Loop Behavior

Port and customs decisions carry real financial and regulatory
consequences, so no agent in this system is allowed to make a final,
consequential call unsupervised. The Escalation and Human Oversight Agent
acts as a mandatory gate: whenever upstream agents produce a low-confidence,
ambiguous, or high-risk result, the graph pauses there rather than
proceeding automatically.

This is made possible by LangGraph's **checkpointer**, which persists the
full graph state at each step. When a case is paused for human review, it
isn't re-run from scratch once an officer acts on it — execution resumes
exactly where it left off, with the full upstream context (tracking data,
extracted documents, risk scores, scheduling recommendation) intact. This
keeps the officer's review fast and auditable, and keeps the system safe
to pause indefinitely without losing state or forcing redundant work.

## 5. Staged Build Order

1. **Phase 0 — Scaffolding:** repo structure, PostgreSQL schema for
   shipment/vessel records, agent decisions, and audit history.
2. **Phase 1 — Ingestion agents:** Tracking Agent and Documentation Agent
   built and validated independently against sample AIS feeds and sample
   trade documents, including PII redaction and prompt-injection guardrails.
3. **Phase 2 — Mid-pipeline agents:** Congestion Prediction Agent and Risk
   & Inspection Routing Agent, each consuming Phase 1 outputs.
4. **Phase 3 — Convergence agent:** Scheduling & Coordination Agent,
   consuming both Phase 2 outputs.
5. **Phase 4 — Human oversight gate:** Escalation & Human Oversight Agent,
   checkpointer wiring, and the pause/resume flow end-to-end.
6. **Phase 5 — Frontend:** the 7 role-based screens, wired to the live
   graph state and PostgreSQL-backed history.
7. **Phase 6 — Benchmarking:** multi-agent vs. single-agent baseline
   comparison (see [PROJECT_DETAILS.md](PROJECT_DETAILS.md)).
