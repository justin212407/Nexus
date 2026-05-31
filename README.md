# NEXUS — Customer Escalation Intelligence Agent

> **One SQL query replaces five API integrations, five auth flows, and 20 minutes of manual detective work.**

![Nexus](https://img.shields.io/badge/built%20for-hackathon-purple) ![Python](https://img.shields.io/badge/python-3.11+-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi) ![LangGraph](https://img.shields.io/badge/LangGraph-1C1C1C?logo=langchain) ![Claude](https://img.shields.io/badge/Claude-Anthropic-FF6F00) ![React](https://img.shields.io/badge/React-20232A?logo=react) ![Coral](https://img.shields.io/badge/Coral%20Protocol-0A66C2)

---

## Problem

A customer submits a support ticket: *"Checkout is broken — users cannot complete payment."*

To diagnose this, a support engineer must:

1. **Check Sentry** — Are there recent errors?
2. **Check Slack** — Are engineers discussing an incident?
3. **Check GitHub** — Was there a recent deploy?
4. **Check Linear** — Is there an existing bug ticket?
5. **Check Intercom** — How many customers are affected?
6. **Correlate timestamps** — Do the events line up?

Each tool has its own API, its own auth, and its own data shape. Manual correlation takes **15–20 minutes** per escalation. Most teams don't have this time, so diagnostics get skipped and engineers waste hours hunting context.

---

## Solution

Nexus is a **5-agent sequential pipeline** that automates the entire correlation and diagnosis workflow in **under 30 seconds**:

1. **Intercom webhook** arrives
2. **Coral Agent** executes a single SQL JOIN across all 5 external APIs (Intercom, Sentry, Slack, GitHub, Linear) — no separate integrations needed
3. **Signal Agent** transforms raw query results into typed, structured signals
4. **Synthesis Agent** (Claude) produces a `TechnicalBrief` — root cause, confidence score, severity, causal chain, and recommended action
5. **Dispatch Agent** routes the brief to Intercom (internal note) and optionally Slack (escalation) based on confidence and severity thresholds

```
Webhook (Intercom)
       │
       ▼
┌──────────────────┐
│  Ticket Agent    │  ← Historical pattern lookup (SQLite)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Coral Agent     │  ← Cross-source SQL JOIN (5 APIs in one query)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Signal Agent    │  ← Parse into typed signals (Sentry, Slack, Deploy, Linear)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Synthesis Agent  │  ← Claude generates TechnicalBrief
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Dispatch Agent  │  ← Route to Intercom + optional Slack
└──────────────────┘
```

---

## Impact

| Metric | Before Nexus | With Nexus |
|--------|--------------|-------------|
| Time to diagnosis | 15–20 minutes | <30 seconds |
| API integrations needed | 5 separate | 1 SQL query |
| Auth implementations | 5 | 1 (Coral) |
| Demo setup time | Hours (api keys, config) | 5 minutes (DEMO_MODE) |
| Classification outcomes | Manual guesswork | Structured (known_bug, user_error, external_dependency) |

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Data Federation** | Coral Protocol | Single SQL query across 5 external APIs |
| **Orchestration** | LangGraph | Typed, sequential 5-agent pipeline |
| **LLM** | Anthropic Claude | Root cause classification + structured diagnosis |
| **Backend** | FastAPI | Async webhook handler, REST API, SSE streaming |
| **Storage** | SQLite | Zero-config incident history |
| **Frontend** | React + Vite | Live dashboard with Server-Sent Events |

---

## Key Features

### 1. Coral Protocol — One Query, Five APIs

No direct HTTP calls to Sentry, Slack, GitHub, or Linear. A single `coral_query()` with 5 LEFT JOINs replaces five separate integrations, auth flows, and data transformations.

```python
from coral.client import coral_query

rows = coral_query(sql=MASTER_QUERY, params={"ticket_id": ticket_id})
# Returns: list[dict] with aligned columns from all 5 sources
```

Each JOIN condition encodes a business rule:
- Sentry: errors within `-2h / +30m` of ticket
- Slack: incident discussions within `-4h`
- GitHub: deploy activity within `-6h`
- Linear: fuzzy title match (engineers don't quote exception class names)

### 2. LangGraph Typed Pipeline

Each agent writes exactly one state key — zero conflicts, no mutation surprises.

```python
class NexusState(TypedDict):
    ticket:        TicketContext      # Set externally before invoke
    result_set:    list[dict]         # Written by: coral_agent
    sentry_signal: SentrySignal       # Written by: signal_agent
    slack_signal:  SlackSignal        # Written by: signal_agent
    deploy_signal: DeploySignal       # Written by: signal_agent
    linear_signal: LinearSignal       # Written by: signal_agent
    brief:         TechnicalBrief     # Written by: synthesis_agent
    dispatched:    bool               # Written by: dispatch_agent
```

### 3. Structured LLM Output (Pydantic Guardrails)

Claude's output is never trusted raw. Always parsed and validated through `TechnicalBrief(**parsed)` — ensures every diagnosis has the correct schema, types, and enumerated values.

```python
from models.brief import TechnicalBrief

brief = TechnicalBrief(**claude_response)  # ValidationError on schema mismatch
```

### 4. DEMO_MODE — Bulletproof Demos

Every external call path checks `settings.DEMO_MODE` and returns deterministic fixture JSON instead. No API keys, no network flakiness, no stage fright.

```python
if settings.DEMO_MODE:
    from coral.mock_client import mock_query
    return mock_query(params)  # Returns deterministic fixture
```

### 5. Async Webhook with Background Tasks

Intercom enforces a 10-second response timeout. The pipeline runs asynchronously via `BackgroundTasks`, returning `200` immediately and streaming progress to the dashboard via Server-Sent Events.

```python
@router.post("/webhook/intercom")
async def webhook(request: Request, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_pipeline, ticket)
    return {"status": "accepted"}  # Returns 200 immediately
```

---

## Demo Scenarios

Three deterministic narratives built into mock fixtures — no live API access needed. Each demonstrates a different classification outcome.

### Scenario A — Checkout Bug

Real incident with full signal fire. Deploy at 14:18, NullPointerException at 14:21 (+3 min), engineer Slack discussions at 14:23, customer ticket at 14:38. Linear issue LIN-2847 already created.

```
root_cause:       "known_bug"
confidence_pct:   ≥88
severity:         "high"
dispatch:         Intercom only (confidence ≥70, severity not critical)
```

**Proves:** End-to-end correlation across all 4 signal types in under 30 seconds.

### Scenario B — False Alarm

All signals return null. No Sentry error, no Slack thread, no deploy, no Linear issue. Customer simply cannot log in.

```
root_cause:       "user_error"
confidence_pct:   ≥88
severity:         "low"
causal_chain:     "No technical errors detected for this user"
dispatch:         Intercom only
```

**Proves:** Nexus confidently distinguishes user error from real bugs, avoiding wasted engineer time.

### Scenario C — Stripe Outage

No internal errors. No recent deploy. No Slack thread. But 50+ tickets on payment keyword pattern indicate an external dependency issue.

```
root_cause:       "external_dependency"
affected_service: "payment-gateway"
causal_chain:     "Third-party dependency (Stripe) showing degradation"
dispatch:         Intercom + Slack (severity=critical triggers escalation)
```

**Proves:** Pattern recognition across ticket volume + confidence-gated escalation routing.

---

## Challenges Overcome

### 1. Domain-Modelling the JOIN Windows

The Coral JOIN time offsets aren't arbitrary — each encodes a business rule:
- **Sentry:** `-2h / +30m` — customers don't report bugs the instant they happen
- **Slack:** `-4h` — engineers see issues in monitoring before customers do
- **GitHub:** `-6h` — deploy-induced regressions surface slowly
- **Linear:** Fuzzy match — engineer-written titles don't quote exception class names

Wrong windows → missed correlations → bad diagnoses.

### 2. Reliable Structured Output from Claude

Getting Claude to return valid, typed JSON every time requires adversarial prompt design:
- Enumerate every key with its type
- Specify enumerated values for categorical fields (`root_cause`, `severity`)
- Instruct Claude to return `null` (not empty string) for unknown values
- Forbid markdown code fences

Pydantic validation + 1 retry catches the remaining edge cases.

### 3. Async Pipeline with a Synchronous Bottleneck

Coral runs as a blocking subprocess in FastAPI's async event loop. In live mode, a slow Coral query blocks the event loop for up to 30 seconds. Solution: `ThreadPoolExecutor` for production; `DEMO_MODE` returns in milliseconds for demos.

### 4. Signal Transformation as a Reliability Layer

Raw Coral rows are untyped `dict`. The `SignalAgent` converts them to typed dataclasses with `found: bool`. This prevents Claude from hallucinating around null values and forces explicit handling in both the prompt and dispatch logic.

---

## Roadmap

- **ThreadPoolExecutor** for Coral subprocess in live mode
- **Redis pub/sub** for multi-instance SSE broadcasting
- **More signal sources** — Datadog, PagerDuty, AWS CloudWatch
- **Automated self-healing** — rollback deploy, restart service, post status page update

---

## Built For

Hackathon project — built to demonstrate cross-source data federation with Coral Protocol, structured LLM output, and confidence-gated routing in a real-world support workflow.

---

## Quick Start

### Prerequisites

- Python 3.11+
- `uv` package manager ([astral.sh/uv](https://astral.sh/uv)) — or pip
- Anthropic API key

### Setup

```bash
git clone <repo-url>
cd Nexus
uv sync
cp .env.example .env
```

Configure `.env`:
```
ANTHROPIC_API_KEY=sk-...
DEMO_MODE=true
```

```bash
uvicorn main:app --reload
```

Server runs on `http://localhost:8000`

### Frontend Dashboard

```bash
cd frontend
npm install
npm run dev   # Starts on http://localhost:5173
```

**Features:** TicketQueue (live tickets with SSE), TechnicalBrief (causal chain + confidence), MetricsBar (real-time classification), AgentStatus (5-step pipeline progress)

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | System health check |
| `/webhook/intercom` | POST | Receive support tickets |
| `/history` | GET | List recent diagnostics |
| `/stats` | GET | Classification breakdown (root_cause, severity counts) |
| `/stream` | GET | Server-Sent Events (real-time pipeline progress) |

### Demo Trigger

```bash
curl -X POST http://localhost:8000/webhook/intercom \
  -H "X-Hub-Signature-256: sha256=demo_bypass" \
  -H "Content-Type: application/json" \
  -d @mock_data/ticket_checkout.json
```

---

## Project Structure

```
Nexus/
├── main.py                     # FastAPI app, startup hooks
├── config.py                   # Settings, env vars, DEMO_MODE flag
├── pyproject.toml              # Build config, dependencies
│
├── agents/                     # One agent per file. No cross-imports.
│   ├── ticket_agent.py         # SQLite history lookup
│   ├── coral_agent.py          # Coral SQL JOIN execution
│   ├── signal_agent.py         # Transform dict[] → typed Signals
│   ├── synthesis_agent.py      # Claude → TechnicalBrief (validated)
│   └── dispatch_agent.py       # Route → Intercom + optional Slack
│
├── models/                     # Data contracts
│   ├── ticket.py               # TicketContext
│   ├── signals.py              # SentrySignal, SlackSignal, DeploySignal, LinearSignal
│   └── brief.py                # TechnicalBrief (Pydantic)
│
├── pipeline/                   # LangGraph wiring
│   ├── state.py                # NexusState TypedDict
│   └── graph.py                # StateGraph: 5 nodes, 6 edges
│
├── coral/                      # Only data access layer
│   ├── client.py               # coral_query() → real or mock
│   ├── queries.py              # MASTER_QUERY (all 4 LEFT JOINs)
│   └── mock_client.py          # Fixture JSON by ticket_id
│
├── db/                         # SQLite (zero-config)
│   ├── models.py               # CREATE TABLE + 3 indexes
│   ├── session.py              # get_session() context manager
│   └── ops.py                  # save_brief(), find_similar(), get_stats()
│
├── integrations/               # Output-only (called by dispatch_agent)
│   ├── intercom.py             # format_intercom_note(), post_internal_note()
│   └── slack.py                # format_slack_escalation(), post_message()
│
├── api/                        # FastAPI routers
│   ├── webhook.py              # POST /webhook/intercom (HMAC + BackgroundTask)
│   ├── history.py              # GET /history, /stats
│   └── stream.py               # GET /stream (SSE + asyncio.Queue)
│
├── mock_data/                  # Deterministic demo fixtures
│   ├── coral_result_a.json     # Scenario A all signals
│   ├── coral_result_b.json     # Scenario B all null
│   ├── coral_result_c.json     # Scenario C external dep
│   └── ticket_*.json           # Webhook payloads
│
└── frontend/                   # React dashboard
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── components/          # TicketQueue, TechnicalBrief, MetricsBar
        └── hooks/               # useSSE hook (EventSource wrapper)
```

---

## Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `ANTHROPIC_API_KEY` | Always | — | Anthropic API key |
| `DEMO_MODE` | No | `false` | Set `true` for testing/demo |
| `INTERCOM_ACCESS_TOKEN` | Live only | — | Intercom API token |
| `INTERCOM_WEBHOOK_SECRET` | Live only | — | Intercom webhook signature secret |
| `SLACK_BOT_TOKEN` | Live only | — | Slack Bot token |
| `SLACK_ESCALATION_CHANNEL` | No | `#nexus-alerts` | Where to escalate |
| `SENTRY_ORG_SLUG` | Live only | — | Sentry organization slug |
| `GITHUB_TOKEN` | Live only | — | GitHub personal access token |
| `LINEAR_API_KEY` | Live only | — | Linear API key |
| `CONFIDENCE_THRESHOLD` | No | `70` | Below → Slack escalation |
| `DATABASE_URL` | No | `sqlite:///nexus.db` | SQLite path |

---

## Running Tests

```bash
pytest          # All tests
pytest -v       # Verbose
pytest tests/test_signal_agent.py  # Specific file
```

---

## Contributing

1. **Coral is the only data access layer** — no agent makes direct HTTP calls
2. **DEMO_MODE must always work** — test with fixtures before any change
3. **One agent per file** — no cross-imports between agents
4. **Tests required** for new agents or signal types

---

## License

MIT

---

**Last updated:** May 31, 2026
