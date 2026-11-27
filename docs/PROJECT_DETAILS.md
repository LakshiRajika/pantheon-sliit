# Project Details

This document covers the project's objectives, features, functionality,
and technical details: the role-based frontend screens, the tech stack,
the benchmarking plan, the data sourcing/disclosure approach, and the AI
tools disclosure required by the competition guidelines. For the agent
state graph, routing logic, checkpointer behavior, and build order, see
[Workflow.md](Workflow.md).

## 1. Objectives

- Give shipping agents, Sri Lanka Customs, and the Sri Lanka Ports
  Authority (SLPA) one shared, continuously updated operational picture,
  instead of three disconnected systems.
- Catch documentation and declaration problems *before* a vessel berths,
  not after, when the cost of a delay has already been incurred.
- Help officers prioritize manual inspection effort under real staffing
  constraints, by surfacing which shipments genuinely warrant review.
- Keep a human officer as the final decision-maker on every consequential
  outcome, with full auditability of how each decision was reached.

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Agent orchestration | LangGraph (`StateGraph`, conditional edges, checkpointer) |
| Backend | Python |
| Frontend | React |
| Database | PostgreSQL |

PostgreSQL persists shipment/vessel records, agent decisions, and audit
history across the system, giving every stakeholder a durable, queryable
record of how and why a decision was made.

## 3. Features: Role-Based Frontend Screens

The frontend exposes seven role-based screens, each mapped to a demo login
representing a real stakeholder in the clearance process:

1. **SLPA Operations View** — berth/yard capacity, congestion forecast,
   scheduling recommendations.
2. **Customs Officer Review Queue** — the Escalation & Human Oversight
   Agent's pending cases, with full upstream context per case.
3. **Shipping Agent / Documentation View** — document submission status,
   validation results, and outstanding requirements per shipment.
4. **Management Overview Dashboard** — cross-cutting KPIs: congestion
   trends, inspection throughput, average clearance time, benchmark
   comparisons.
5–7. **Agent-flow-aligned views** — additional screens tied to specific
   stages of the agent pipeline (e.g., tracking/vessel monitoring, risk
   routing detail, audit/history view), supporting the same underlying
   state without duplicating logic across roles.

## 4. Benchmarking Plan: Multi-Agent vs. Single-Agent Baseline

To validate that the multi-agent decomposition is worth its added
complexity, the system is benchmarked against a single-agent baseline that
receives the same inputs (tracking, documentation, aggregate statistics)
and is asked to produce the same outputs (risk classification, congestion
forecast, scheduling recommendation) in one pass.

Comparison dimensions:

- **Accuracy / agreement with ground truth** (or with human officer
  decisions, where ground truth is unavailable) on risk classification and
  congestion forecasts.
- **False positive / false negative rate on inspection flagging** — since
  over-flagging defeats the staffing-prioritization goal, and
  under-flagging defeats the risk-mitigation goal.
- **Latency and cost per case**, since the multi-agent pipeline necessarily
  costs more per decision than a single call.
- **Escalation rate** — how often each approach produces a confident
  automated result versus requiring human review, as a proxy for whether
  the decomposition is actually surfacing the right cases rather than
  escalating everything or nothing.
- **Auditability** — qualitative comparison of how much of the reasoning
  behind a decision is inspectable after the fact (structured per-agent
  state vs. a single opaque model output).

The hypothesis under test is that decomposing the problem into specialized
agents improves both accuracy and auditability over a single-agent
baseline, at an acceptable cost in latency/compute — and that this
trade-off is justified for a domain where decisions carry real financial
and regulatory consequences.

## 5. Data Sourcing & Disclosure

The system draws on three categories of data, which are not treated
interchangeably and are disclosed as such wherever they appear in the
product:

| Category | Sources | Status |
|---|---|---|
| Real-time vessel tracking | AIS-derived data in the style of VesselFinder / MarineTraffic / Kpler | Real, live |
| Public aggregate statistics | SLPA, Sri Lanka Customs, CEIC, World Bank LPI | Real, public |
| Operational data not publicly available (customs risk scores, live yard occupancy) | Calibrated simulator | **Simulated, clearly disclosed** |

The simulator is calibrated against publicly available aggregate
statistics (e.g., SLPA throughput figures, World Bank Logistics
Performance Index indicators) so that simulated values are plausible and
internally consistent, rather than arbitrary. Every screen and data point
derived from the simulator is labeled as such in the UI — this is a
disclosed stand-in for operational data that is not publicly accessible
(e.g., Sri Lanka Customs' internal risk scoring, SLPA's live yard occupancy
feed), not a claim that this data was obtained from those systems.

## 6. AI Tools and Models Disclosed

The following AI coding assistants and models were used in building this
project, as required by the competition guidelines:

- **Claude Code** (Anthropic), running on **Claude Sonnet 5** — used for
  project documentation, architecture planning, and implementation support.

The following LLM providers and models are used at runtime, inside the
product itself, by the Risk & Inspection Agent and the role-specific chat
assistants. They are tried in order, with each one falling back to the
next on failure, and a deterministic rule-based fallback underneath all
three if none are available:

- **Groq** — `openai/gpt-oss-120b`
- **Google Gemini** — `gemini-flash-latest`
- **OpenRouter** — `openrouter/free`
