# Zenith — Customer Escalation Intelligence Agent

> **Sequential multi-agent pipeline** that transforms incoming Intercom support tickets into structured technical diagnoses in under 30 seconds via Coral Protocol.

## What is Zenith?

Zenith is a hackathon-built system that executes one cross-source SQL JOIN across five external APIs—Intercom, Sentry, Slack, GitHub, Linear—via **Coral Protocol**. Instead of five independent API integrations, five auth flows, and 20 minutes of manual correlation work, Zenith delivers a single structured technical diagnosis (`TechnicalBrief`) in under 30 seconds.

**Core value proposition:** One SQL query replaces five API integrations, five auth implementations, and 20 minutes of manual detective work.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Webhook (Intercom)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │   Ticket Agent (SQLite)    │ ← Historical pattern lookup
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Coral Agent (SQL JOIN)    │ ← Cross-source correlation
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │   Signal Agent (Parse)     │ ← Sentry, Slack, Deploy, Linear
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ Synthesis Agent (Claude)   │ ← Generate TechnicalBrief
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Dispatch Agent (Route)    │ ← Intercom + optional Slack
        └────────────────────────────┘
```

**Tech Stack:**
- **FastAPI** — REST API & webhook handler
- **LangGraph** — Orchestration (straight-line DAG, no branching)
- **Anthropic Claude** — Structured synthesis & diagnosis
- **Coral Protocol** — Unified data access layer
- **SQLite** — Zero-config incident history
- **React + Vite** — Live dashboard with Server-Sent Events

---

## Quick Start

### Prerequisites

- Python 3.11+
- `uv` package manager (https://astral.sh/uv) — or pip
- Anthropic API key
- Internet access (for Coral Protocol)

### Setup

1. **Clone and navigate:**
   ```bash
   git clone <repo-url>
   cd zenith
   ```

2. **Install dependencies:**
   ```bash
   uv sync  # or: uv pip install -r requirements.txt
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Configure `.env`:**
   ```
   ANTHROPIC_API_KEY=sk-...
   DEMO_MODE=true        # Set to true for demo/testing
   CONFIDENCE_THRESHOLD=70
   DATABASE_URL=sqlite:///nexus.db
   ```

5. **Run the server:**
   ```bash
   uvicorn main:app --reload
   ```

   Server runs on `http://localhost:8000`

---

## Key Features

### 1. **Coral Protocol Data Layer**
The only way to access external data. No direct HTTP calls to Sentry, Slack, GitHub, Linear.

```python
from coral.client import coral_query

rows = coral_query(sql=MASTER_QUERY, params={"ticket_id": ticket_id})
# Returns: list[dict] with aligned columns from all 5 sources
```

### 2. **Typed State Management (LangGraph)**
Each agent writes exactly one state key — no conflicts, no mutations.

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

### 3. **DEMO_MODE for Bulletproof Demos**
Never call real APIs on stage. Every code path checks `settings.DEMO_MODE` and uses fixture JSON instead.

```python
if settings.DEMO_MODE:
    from coral.mock_client import mock_query
    return mock_query(params)  # Returns deterministic fixture
```

### 4. **Structured LLM Output (Pydantic Validation)**
Claude's output is never trusted raw. Always parsed through `TechnicalBrief(**parsed)`.

```python
from models.brief import TechnicalBrief

brief = TechnicalBrief(**claude_response)  # ValidationError on schema mismatch
```

### 5. **Webhook + Background Tasks**
Intercom has a 10s response timeout. Pipeline runs async in `BackgroundTasks`.

```python
@router.post("/webhook/intercom")
async def webhook(request: Request, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_pipeline, ticket)
    return {"status": "accepted"}  # Returns 200 immediately
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | System health check |
| `/webhook/intercom` | POST | Receive support tickets |
| `/history` | GET | List recent diagnostics |
| `/stats` | GET | Classification breakdown (root_cause, severity counts) |
| `/stream` | GET | Server-Sent Events (real-time pipeline progress) |

### Example: Trigger via cURL (demo mode)

```bash
curl -X POST http://localhost:8000/webhook/intercom \
  -H "X-Hub-Signature-256: sha256=demo_bypass" \
  -H "Content-Type: application/json" \
  -d @mock_data/ticket_checkout.json
```

---

## Demo Scenarios

Three deterministic narratives built into mock fixtures:

### Scenario A — Checkout Bug
**All 4 signals fire.** Deploy at 14:18, NullPointerException at 14:21 (+3 min), engineer mentions in Slack at 14:23, customer ticket at 14:38. Linear issue LIN-2847 already created.

```
root_cause:     "known_bug"
confidence_pct: ≥88
severity:       "high"
dispatch:       Intercom only (confidence ≥70, severity not critical)
```

**File:** `mock_data/coral_result_a.json`

### Scenario B — False Alarm
**All values null.** No Sentry error, no Slack thread, no deploy, no Linear issue. Customer cannot log in.

```
root_cause:     "user_error"
confidence_pct: ≥88
severity:       "low"
causal_chain:   "No technical errors detected for this user"
dispatch:       Intercom only
```

**File:** `mock_data/coral_result_b.json`

### Scenario C — Stripe Outage
**No internal errors.** No recent deploy. No Slack thread. 50 tickets on payment keyword pattern.

```
root_cause:     "external_dependency"
affected_service: "payment-gateway"
causal_chain:   "Third-party dependency (Stripe) showing degradation"
dispatch:       Intercom + Slack (confidence <70 OR severity="high")
```

**File:** `mock_data/coral_result_c.json`

---

## Project Structure

```
zenith/
├── main.py                     # FastAPI app, startup hooks
├── config.py                   # Settings, env vars, DEMO_MODE flag
├── pyproject.toml              # Build config, dependencies
├── requirements.txt            # Pinned deps
│
├── agents/                     # One agent per file. No cross-imports.
│   ├── ticket_agent.py         # SQLite history lookup
│   ├── coral_agent.py          # Coral SQL JOIN execution
│   ├── signal_agent.py         # Transform dict[] → typed Signals
│   ├── synthesis_agent.py      # Claude → TechnicalBrief (validated)
│   └── dispatch_agent.py       # Route → Intercom + optional Slack
│
├── models/                     # Data contracts (locked Day 1)
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

## Absolute Rules (Do Not Violate)

1. **Coral is the only data access layer.** No agent makes direct HTTP calls.
2. **DEMO_MODE is sacred.** Check `settings.DEMO_MODE` before any external API call.
3. **One writer per state key.** Each NexusState key is written by exactly one agent.
4. **Typed over untyped.** Never pass raw `dict` or `None` to Claude.
5. **Pydantic validates all LLM output.** Always parse through `TechnicalBrief(**parsed)`.
6. **Sequential pipeline, no parallel branches.** Straight line: ticket → coral → signal → synthesis → dispatch.
7. **Return 200 immediately from webhook.** Use `BackgroundTasks.add_task()`.
8. **Fixtures tell the demo story.** Do not overwrite mock data column names.

---

## Running Tests

```bash
# Run all tests
pytest

# Verbose output
pytest -v

# Run a specific file
pytest tests/test_signal_agent.py

# Watch mode
pytest-watch tests/
```

---

## Development Workflow

### 1. Validate Gates (Before Deploying)

```bash
# Gate 1: Server starts
uvicorn main:app 2>&1 | grep "Uvicorn running"

# Gate 2: Pydantic validation works
python -c "from models.brief import TechnicalBrief; TechnicalBrief(root_cause='bad')"

# Gate 3: Coral mock returns correct columns
python -c "from coral.client import coral_query; print(list(coral_query('SELECT 1', {'ticket_id':'ticket_checkout'})[0].keys()))"

# Gate 6: Graph invocation works end-to-end
python -c "from pipeline.graph import nexus_graph; ..."

# Gate 7: Webhook accepts demo
curl -X POST /webhook/intercom -H "X-Hub-Signature-256: sha256=demo_bypass" ...
```

### 2. Debug a Signal

```python
# In ipython or a test file:
from coral.client import coral_query
from agents.signal_agent import run_signal_agent
from pipeline.state import NexusState

rows = coral_query("SELECT * FROM ...", {"ticket_id": "ticket_checkout"})
state = NexusState(
    ticket=...,
    result_set=rows,
    ...
)
signals = run_signal_agent(state)
print(signals)  # See all signals populated
```

### 3. Test Claude Output Parsing

```python
from models.brief import TechnicalBrief
import json

raw_response = '{"root_cause": "known_bug", "confidence_pct": 88, ...}'
brief = TechnicalBrief(**json.loads(raw_response))
print(brief.root_cause)  # Pydantic coerces & validates
```

---

## Environment Variables

All `DEMO_MODE=true` disables live API calls. Full reference in `config.py`:

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

## Coral Protocol Setup (Live Mode Only)

```bash
brew install withcoral/tap/coral   # macOS
# or: cargo install coral-cli      # From source

coral source add intercom          # Interactive setup
coral source add sentry
coral source add slack
coral source add github
coral source add linear

coral source list                  # Verify all green
coral sql "SELECT * FROM sentry.issues LIMIT 1"  # Smoke test
```

---

## Frontend Dashboard

Located in `/frontend`. Requires Node.js 18+.

```bash
cd frontend
npm install
npm run dev   # Starts on http://localhost:5173
```

**Features:**
- **TicketQueue** — Live incoming tickets with SSE updates
- **TechnicalBrief** — Card display: causal chain timeline, confidence pill, recommendation
- **MetricsBar** — Real-time classification breakdown
- **AgentStatus** — 5-step pipeline progress visualization

---

## Common Issues & Troubleshooting

### 1. **"ModuleNotFoundError: No module named 'coral'"**
   - Coral CLI not installed or not in PATH
   - Run `coral --version` to verify installation
   - Add to PATH if needed

### 2. **Claude returns invalid JSON**
   - Check `temperature` in `synthesis_agent.py` — must be 0 for determinism
   - Verify `SYSTEM_PROMPT` includes "respond ONLY with JSON"
   - Retry logic will attempt 2 calls before fallback

### 3. **SQLite "database is locked"**
   - Only one writer at a time
   - Use `get_session()` context manager
   - Check for long-running transactions

### 4. **SSE events not arriving at dashboard**
   -Verify `X-Accel-Buffering: no` header in `stream.py`
   - Nginx may buffer responses without this
   - Each event must include `ticket_id` for routing

### 5. **Webhook returns 400: Invalid HMAC**
   - Verify `INTERCOM_WEBHOOK_SECRET` in `.env` matches Intercom dashboard
   - For demo, use `X-Hub-Signature-256: sha256=demo_bypass`

---

## Contributing

1. **Respect the rules** (see "Absolute Rules" section above)
2. **Add tests** for new agents or signal types
3. **Update `CONTEXT.md`** if domain language changes
4. **Keep DEMO_MODE working** — always test with fixtures first
5. **One agent per file** — no cross-imports between agents

---

## License

MIT

---

## Contact & Feedback

Built as a hackathon project. For questions or feedback, open an issue on GitHub.

**Key documentation:**
- [01_ARCHITECTURE.md](docs/01_ARCHITECTURE.md)
- [02_AGENT_PIPELINE.md](docs/02_AGENT_PIPELINE.md)
- [03_CORAL_DATA_LAYER.md](docs/03_CORAL_DATA_LAYER.md)
- [04_API_COMPLEXITY.md](docs/04_API_COMPLEXITY.md)
- [05_STRUCTURE_SETUP.md](docs/05_STRUCTURE_SETUP.md)

---

**Last updated:** May 19, 2026
