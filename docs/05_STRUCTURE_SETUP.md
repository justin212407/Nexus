# NEXUS — Project Structure & Setup Guide

> Full repository layout, environment setup, and build sequence

---

## Repository Layout

```
nexus/
│
├── main.py                        # FastAPI app entry point + startup
├── config.py                      # Settings from env vars (pydantic-settings)
├── requirements.txt
├── .env.example                   # All required env vars with descriptions
├── README.md
│
├── agents/                        # One agent per file — no shared state mutations
│   ├── __init__.py
│   ├── ticket_agent.py            # Parses Intercom webhook → TicketContext
│   ├── coral_agent.py             # Executes Coral SQL → raw result set
│   ├── signal_agent.py            # Transforms result set → 4x Signal dataclasses
│   ├── synthesis_agent.py         # Calls Claude → TechnicalBrief
│   └── dispatch_agent.py          # Routes brief → Intercom + Slack + SQLite
│
├── models/                        # Pydantic models and dataclasses
│   ├── __init__.py
│   ├── ticket.py                  # TicketContext dataclass
│   ├── signals.py                 # SentrySignal, SlackSignal, DeploySignal, LinearSignal
│   └── brief.py                   # TechnicalBrief Pydantic model
│
├── pipeline/                      # LangGraph orchestration
│   ├── __init__.py
│   ├── state.py                   # NexusState TypedDict
│   └── graph.py                   # StateGraph definition, node registration, edges
│
├── coral/                         # Coral Protocol interface
│   ├── __init__.py
│   ├── client.py                  # coral_query() — real or mock based on DEMO_MODE
│   ├── queries.py                 # All SQL query strings (MASTER_QUERY)
│   └── mock_client.py             # Returns fixture JSON — used when DEMO_MODE=true
│
├── db/                            # SQLite storage
│   ├── __init__.py
│   ├── models.py                  # CREATE TABLE SQL
│   ├── session.py                 # SQLite connection factory (context manager)
│   └── ops.py                     # save_brief(), find_similar(), get_stats()
│
├── integrations/                  # External API clients (output only)
│   ├── __init__.py
│   ├── intercom.py                # POST internal note to ticket
│   └── slack.py                   # post_message() with Block Kit formatting
│
├── api/                           # FastAPI routers
│   ├── __init__.py
│   ├── webhook.py                 # POST /webhook/intercom (HMAC + background task)
│   ├── history.py                 # GET /history, GET /stats
│   └── stream.py                  # GET /stream (SSE for dashboard)
│
├── mock_data/                     # Deterministic demo fixtures
│   ├── ticket_checkout.json       # Scenario A — checkout bug (Intercom webhook shape)
│   ├── ticket_login.json          # Scenario B — false alarm
│   ├── ticket_payment.json        # Scenario C — Stripe outage (50 tickets pattern)
│   ├── coral_result_a.json        # Coral output for Scenario A (all signals found)
│   ├── coral_result_b.json        # Coral output for Scenario B (all nulls)
│   └── coral_result_c.json        # Coral output for Scenario C (external pattern)
│
└── frontend/                      # React dashboard
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── App.jsx                # Root component, SSE connection management
        ├── components/
        │   ├── TicketQueue.jsx    # Live list of in-progress and completed tickets
        │   ├── TechnicalBrief.jsx # Card rendering brief.causal_chain, confidence
        │   ├── MetricsBar.jsx     # classification_breakdown from /stats
        │   └── AgentStatus.jsx    # SSE event → animated pipeline progress
        └── hooks/
            └── useSSE.js          # EventSource wrapper with auto-reconnect
```

---

## config.py

```python
# config.py

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Required for LLM synthesis
    ANTHROPIC_API_KEY: str

    # Required for real dispatch (not needed in DEMO_MODE)
    INTERCOM_ACCESS_TOKEN: str = ""
    INTERCOM_WEBHOOK_SECRET: str = "demo_secret"
    SLACK_BOT_TOKEN: str = ""
    SLACK_ESCALATION_CHANNEL: str = "#nexus-alerts"

    # Required for real Coral sources (not needed in DEMO_MODE)
    SENTRY_ORG_SLUG: str = ""
    GITHUB_TOKEN: str = ""
    LINEAR_API_KEY: str = ""

    # Behaviour config
    DEMO_MODE: bool = False
    CONFIDENCE_THRESHOLD: int = 70
    DATABASE_URL: str = "sqlite:///nexus.db"

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## .env.example

```bash
# .env.example — copy to .env and fill in

# === REQUIRED IN ALL MODES ===
ANTHROPIC_API_KEY=sk-ant-...

# === DEMO MODE (set to true for hackathon demo) ===
DEMO_MODE=true

# === REQUIRED FOR LIVE MODE ===
INTERCOM_ACCESS_TOKEN=
INTERCOM_WEBHOOK_SECRET=
SLACK_BOT_TOKEN=xoxb-...
SLACK_ESCALATION_CHANNEL=#nexus-alerts
SENTRY_ORG_SLUG=my-company
GITHUB_TOKEN=ghp_...
LINEAR_API_KEY=lin_api_...

# === OPTIONAL ===
CONFIDENCE_THRESHOLD=70
DATABASE_URL=sqlite:///nexus.db
```

---

## requirements.txt

```txt
fastapi==0.110.0
uvicorn[standard]==0.29.0
langgraph==0.1.19
anthropic==0.25.0
langchain-core==0.1.52
pydantic==2.7.0
pydantic-settings==2.2.1
sqlalchemy==2.0.29
slack-bolt==4.18.0
httpx==0.27.0
python-dotenv==1.0.1
pytest==8.1.2
pytest-asyncio==0.23.6
```

---

## Setup & Run

### 1. Clone and install

```bash
git clone https://github.com/yourname/nexus.git
cd nexus
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Set ANTHROPIC_API_KEY
# Set DEMO_MODE=true for local dev
```

### 3. Set up Coral sources (live mode only)

```bash
brew install withcoral/tap/coral      # macOS
coral source add intercom             # prompts for token
coral source add sentry
coral source add slack
coral source add github
coral source add linear
coral source list                     # verify all 5 are green
coral sql "SELECT * FROM sentry.issues LIMIT 1"   # smoke test
```

### 4. Run the backend

```bash
DEMO_MODE=true uvicorn main:app --reload --port 8000
```

### 5. Run the frontend

```bash
cd frontend
npm install
npm run dev     # starts on http://localhost:5173
```

### 6. Trigger a demo scenario

```bash
# Scenario A — Checkout Bug (high confidence, no Slack escalation)
curl -X POST http://localhost:8000/webhook/intercom \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=demo_bypass" \
  -d @mock_data/ticket_checkout.json

# Scenario B — False Alarm (user error, 94% confidence)
curl -X POST http://localhost:8000/webhook/intercom \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=demo_bypass" \
  -d @mock_data/ticket_login.json

# Scenario C — Stripe Outage (external dependency, Slack escalation)
curl -X POST http://localhost:8000/webhook/intercom \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=demo_bypass" \
  -d @mock_data/ticket_payment.json
```

---

## Build Sequence (Hackathon Day Plan)

| Step | Task | Time | Gate |
|---|---|---|---|
| 1 | Project skeleton, /health endpoint | 1h | `curl /health` → 200 |
| 2 | Mock data fixtures (3 scenarios) | 1h | All 3 load in Python |
| 3 | Coral client + mock client | 1h | DEMO_MODE returns fixture |
| 4 | Build each agent standalone (print output) | 2h | Each accepts input, returns correct type |
| 5 | Wire LangGraph pipeline | 2h | `graph.invoke()` returns brief |
| 6 | FastAPI webhook + background task | 1h | curl → 200 → brief in /history |
| 7 | Intercom + Slack dispatch | 1h | Note appears in Intercom ticket |
| 8 | SSE stream + React dashboard | 2h | Trigger webhook → watch dashboard update |
| **Total** | | **11h** | |

---

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=term-missing

# Test webhook endpoint only
pytest tests/test_webhook.py -v

# Test signal extraction
pytest tests/test_signal_agent.py -v
```

### Test structure

```
tests/
├── test_webhook.py        # HMAC validation, 200 response, background task kick-off
├── test_signal_agent.py   # Signal extraction from all-populated and all-null fixtures
├── test_synthesis.py      # Claude prompt → TechnicalBrief validation (mocked Anthropic)
├── test_dispatch.py       # Routing logic (confidence threshold, severity rules)
└── conftest.py            # Shared fixtures (mock ticket, mock brief, test client)
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Always | — | Claude API key |
| `DEMO_MODE` | No | `false` | `true` → use mock fixtures, skip real Coral + API calls |
| `INTERCOM_ACCESS_TOKEN` | Live only | — | Posts internal notes to tickets |
| `INTERCOM_WEBHOOK_SECRET` | Live only | — | Validates incoming webhook signatures |
| `SLACK_BOT_TOKEN` | Live only | — | Posts escalation messages |
| `SLACK_ESCALATION_CHANNEL` | Live only | `#nexus-alerts` | Target channel for escalations |
| `SENTRY_ORG_SLUG` | Live only | — | Coral uses this for Sentry source auth |
| `GITHUB_TOKEN` | Live only | — | Coral uses this for GitHub source auth |
| `LINEAR_API_KEY` | Live only | — | Coral uses this for Linear source auth |
| `CONFIDENCE_THRESHOLD` | No | `70` | Below this → trigger Slack escalation |
| `DATABASE_URL` | No | `sqlite:///nexus.db` | Path to SQLite DB |
