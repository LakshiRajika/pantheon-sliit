# Pantheon — Colombo Port Congestion & Customs Clearance

**Innodata AI Catalyst '26 — University Track (Sri Lanka)**
**Domain:** Logistics
**Team:** Pantheon

## Problem Statement

Vessel arrival data, customs/trade documentation, and port yard/berth capacity
currently live in three disconnected systems, each owned by a different
stakeholder:

- **Shipping agents** — vessel schedules and arrival notices
- **Sri Lanka Customs** — trade documentation and clearance declarations
- **Sri Lanka Ports Authority (SLPA)** — yard and berth capacity

Because none of these systems talk to each other, problems like missing
documents or inconsistent declarations are typically only caught *after* a
vessel has already berthed — at which point the cost of delay has already
been incurred. At the same time, staffing at clearance and inspection points
is limited, so officers lack a reliable way to prioritize which shipments
genuinely warrant manual review versus which can proceed without delay.

## Proposed Solution

A coordinated multi-agent AI system that ties vessel tracking, trade
documentation, and port capacity data into one shared, continuously updated
operational picture — with a human officer kept in the loop for every
consequential decision. The system forecasts congestion before it happens,
flags the shipments that actually need manual inspection, and recommends
berth/resource scheduling accordingly, while leaving final judgment calls
on ambiguous or high-risk cases to a human reviewer.

## Tech Stack

| Layer | Technology |
|---|---|
| Agent orchestration | LangGraph (`StateGraph`, conditional edges, checkpointer) |
| Backend | Python |
| Frontend | React |
| Database | PostgreSQL |

PostgreSQL persists shipment/vessel records, agent decisions, and audit
history across the system, giving every stakeholder a durable, queryable
record of how and why a decision was made.

## Agent Architecture

Six agents are connected through a single LangGraph `StateGraph` with
conditional routing and a checkpointer for state persistence. Each agent
has a narrow responsibility and hands a structured, validated state forward
to the next stage.

1. **Tracking Agent** — ingests live vessel position/speed/ETA from AIS
   tracking sources.
2. **Documentation Agent** — extracts and validates trade documents (bills
   of lading, invoices, certificates of origin), applies PII redaction and
   basic prompt-injection guardrails before any extracted content is passed
   downstream.
3. **Congestion Prediction Agent** — combines live tracking data with
   historical/aggregate statistics to forecast berth congestion ahead of
   time.
4. **Risk and Inspection Routing Agent** — flags which shipments genuinely
   need closer human inspection versus which can proceed normally.
5. **Scheduling and Coordination Agent** — recommends berth/resource
   scheduling based on the congestion forecast and risk routing output.
6. **Escalation and Human Oversight Agent** — the formal gate. Anything
   ambiguous, high-risk, or low-confidence pauses here for a human officer
   to make the final call.

### Dependency Chain

```
Tracking Agent ──┐
                  ├─► Congestion Prediction Agent ─┐
Documentation ────┘                                ├─► Scheduling & Coordination Agent ─► Escalation & Human Oversight Agent
Agent ────────────────► Risk & Inspection ─────────┘
                        Routing Agent
```

Tracking and Documentation run as independent ingestion agents. Their
outputs feed the Congestion Prediction Agent and the Risk and Inspection
Routing Agent respectively, which run in parallel. Both converge into the
Scheduling and Coordination Agent, whose recommendation is finally reviewed
by the Escalation and Human Oversight Agent before anything becomes an
actionable decision.

## Human-in-the-Loop & Checkpointer Reasoning

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

## Documentation

See [`docs/`](docs/) for the full proposal and detailed architecture,
including the state graph design, conditional routing logic, the 7
role-based frontend screens, the benchmarking plan (multi-agent vs.
single-agent baseline), and the data sourcing/disclosure approach for
simulated components.
