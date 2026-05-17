# Zenith — Copilot Instructions
# Customer Escalation Intelligence Agent · Built on Coral Protocol
# Version: 1.0 · Hackathon Build · May 2025

---

## WHAT THIS PROJECT IS

Zenith is a **sequential multi-agent pipeline** that transforms an incoming Intercom support ticket into a structured technical diagnosis (called a `TechnicalBrief`) in under 30 seconds.

It does this by executing **one cross-source SQL JOIN** across five external APIs — Intercom, Sentry, Slack, GitHub, Linear — via Coral Protocol. The result is synthesised through Claude and dispatched to the correct destination based on confidence thresholds.

**The core value proposition:** One SQL query replaces five independent API integrations, five auth flows, five pagination implementations, and 20 minutes of manual correlation work.

---

## ABSOLUTE RULES — READ BEFORE WRITING ANY CODE

1. **Coral is the only data access layer.** No agent makes direct HTTP calls to Sentry, Slack, GitHub, or Linear. Everything goes through `coral.client.coral_query()`. If you are writing `requests.get("https://sentry.io/...")` inside an agent, you are doing it wrong.

2. **DEMO_MODE is sacred.** Every piece of code that touches an external API must check `settings.DEMO_MODE`. If True, use fixture data. Never call real APIs in demo mode. This is the difference between a working demo and a live failure on stage.

3. **One writer per state key.** In LangGraph, each key in `NexusState` is written by exactly one agent. Never have two agents write to the same key. Never mutate `state` in place inside a node function — always return a partial dict.

4. **typed over untyped, always.** Never pass raw `dict` or `None` to Claude. Transform everything through typed dataclasses first. The `found: bool` pattern on every Signal dataclass is not optional.

5. **Pydantic validates all LLM output.** Claude's response is never trusted raw. Always parse through `TechnicalBrief(**parsed)`. A ValidationError is a feature, not a bug — it triggers a retry.

6. **Sequential pipeline, no parallel branches.** The graph is a straight line: ticket → coral → signal → synthesis → dispatch. Do not add parallel nodes, conditional edges, or subgraphs for the hackathon build.

7. **Return 200 immediately from the webhook.** Never run the pipeline synchronously inside the webhook handler. Always use `BackgroundTasks.add_task()`.

8. **Fixtures tell the demo story.** The three `mock_data/coral_result_*.json` files are designed narratives, not random test data. Do not overwrite them. Do not change their column names without updating `coral/queries.py` aliases AND `agents/signal_agent.py` simultaneously.

---

## REPOSITORY STRUCTURE — EVERY FILE EXPLAINED

```
zenith/
├── main.py                     # FastAPI app, router registration, startup hook, /health
├── config.py                   # pydantic-settings, all env vars, DEMO_MODE flag
├── requirements.txt            # pinned dependencies — do not upgrade without testing
├── .env.example                # template for all env vars — committed, .env is not
├── README.md                   # setup guide for judges
│
├── agents/                     # One agent per file. No cross-agent imports.
│   ├── __init__.py
│   ├── ticket_agent.py         # Parses TicketContext + SQLite history lookup
│   ├── coral_agent.py          # Executes MASTER_QUERY via coral_query()
│   ├── signal_agent.py         # Transforms list[dict] → 4x typed Signal dataclasses
│   ├── synthesis_agent.py      # Calls Claude API → parses + validates TechnicalBrief
│   └── dispatch_agent.py       # Confidence-gated routing → Intercom + optional Slack
│
├── models/                     # Data contracts — agree these before writing agents
│   ├── __init__.py
│   ├── ticket.py               # TicketContext dataclass — shared contract, lock Day 1
│   ├── signals.py              # SentrySignal, SlackSignal, DeploySignal, LinearSignal
│   └── brief.py                # TechnicalBrief Pydantic model — lock Day 1
│
├── pipeline/                   # LangGraph wiring
│   ├── __init__.py
│   ├── state.py                # NexusState TypedDict — lock Day 2, never rename fields
│   └── graph.py                # StateGraph: 5 nodes, 6 edges, compile() → nexus_graph
│
├── coral/                      # Coral Protocol interface — the only data access layer
│   ├── __init__.py
│   ├── client.py               # coral_query() — routes to real or mock via DEMO_MODE
│   ├── queries.py              # MASTER_QUERY string — all 4 LEFT JOINs live here
│   └── mock_client.py          # Returns fixture JSON keyed by ticket_id
│
├── db/                         # SQLite storage — zero-config, no server required
│   ├── __init__.py
│   ├── models.py               # CREATE TABLE + 3 indexes
│   ├── session.py              # get_session() context manager
│   └── ops.py                  # save_brief(), find_similar(), get_stats(), log_dispatch()
│
├── integrations/               # Output-only API clients — called only by dispatch_agent
│   ├── __init__.py
│   ├── intercom.py             # format_intercom_note() + post_internal_note()
│   └── slack.py                # format_slack_escalation() + post_message()
│
├── api/                        # FastAPI routers
│   ├── __init__.py
│   ├── webhook.py              # POST /webhook/intercom — HMAC + BackgroundTask
│   ├── history.py              # GET /history, GET /stats
│   └── stream.py               # GET /stream — SSE with asyncio.Queue + broadcast()
│
├── mock_data/                  # Deterministic demo fixtures — DO NOT MODIFY COLUMN NAMES
│   ├── ticket_checkout.json    # Scenario A webhook shape — checkout bug
│   ├── ticket_login.json       # Scenario B webhook shape — false alarm / user error
│   ├── ticket_payment.json     # Scenario C webhook shape — Stripe outage
│   ├── coral_result_a.json     # Scenario A Coral output — all 4 signals populated
│   ├── coral_result_b.json     # Scenario B Coral output — all values null
│   └── coral_result_c.json     # Scenario C Coral output — no internal errors
│
└── frontend/                   # React dashboard
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── App.jsx             # Root component + SSE connection lifecycle
        ├── components/
        │   ├── TicketQueue.jsx     # Live ticket list with SSE updates
        │   ├── TechnicalBrief.jsx  # Card: causal_chain timeline + confidence pill
        │   ├── MetricsBar.jsx      # classification_breakdown from GET /stats
        │   └── AgentStatus.jsx     # 5-step pipeline progress from SSE events
        └── hooks/
            └── useSSE.js           # EventSource wrapper with auto-reconnect
```

---

## DATA MODELS — THE CONTRACTS EVERYTHING IS BUILT ON

### TicketContext (`models/ticket.py`)
```python
from dataclasses import dataclass
from datetime import datetime

@dataclass
class TicketContext:
    ticket_id:      str
    customer_email: str
    message_body:   str
    created_at:     datetime
    priority:       str        # "urgent" | "normal" | "low"
    tags:           list[str]
```
**This is a shared contract. Lock it on Day 1. Both the webhook handler and coral_agent read from it.**

---

### Signal Dataclasses (`models/signals.py`)
All four follow the same pattern: `found: bool` is always first. When `found=False`, all other fields are None or 0. Never pass a Signal with `found=False` fields containing data — it confuses Claude.

```python
from dataclasses import dataclass

@dataclass
class SentrySignal:
    found:          bool
    issue_id:       str | None
    error_title:    str | None
    culprit:        str | None    # "PaymentService.java:processCheckout"
    first_seen:     str | None    # ISO timestamp string
    occurrences:    int           # default 0 when not found
    affected_users: int           # default 0 when not found
    level:          str | None    # "fatal" | "error" | "warning"

@dataclass
class SlackSignal:
    found:            bool
    thread_count:     int         # default 0 when not found
    earliest_mention: str | None  # ISO timestamp string
    messages:         list[dict]  # [{author, text, ts}] — empty list when not found
    already_known:    bool        # True only when thread_count > 0

@dataclass
class DeploySignal:
    found:                 bool
    deploy_sha:            str | None
    deploy_time:           str | None    # ISO timestamp string
    minutes_before_ticket: int | None   # computed: ticket.created_at - deploy_time
    description:           str | None   # commit message

@dataclass
class LinearSignal:
    found:       bool
    issue_id:    str | None    # "LIN-2847"
    issue_title: str | None
    status:      str | None    # "Todo" | "In Progress" | "In Review"
    assignee:    str | None
```

---

### TechnicalBrief (`models/brief.py`)
```python
from pydantic import BaseModel, field_validator
from typing import Literal

class TechnicalBrief(BaseModel):
    root_cause:              Literal["known_bug", "service_degradation",
                                     "user_error", "external_dependency", "unknown"]
    confidence_pct:          int       # 0–100, coerce from str if needed
    severity:                Literal["low", "medium", "high", "critical"]
    affected_service:        str
    affected_users:          int
    causal_chain:            list[str] # timestamped strings, min 1 element
    engineer_summary:        str       # max 3 sentences, technical language
    draft_customer_response: str       # empathetic, non-technical, max 3 sentences
    recommended_action:      str
    linear_issue_id:         str | None  # "LIN-2847" or null — never empty string

    @field_validator("confidence_pct", mode="before")
    @classmethod
    def coerce_confidence(cls, v):
        return int(v)  # handles "87" → 87

    @field_validator("linear_issue_id", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        return None if v == "" else v
```

---

### NexusState (`pipeline/state.py`)
```python
from typing import TypedDict
from models.ticket import TicketContext
from models.signals import SentrySignal, SlackSignal, DeploySignal, LinearSignal
from models.brief import TechnicalBrief

class NexusState(TypedDict):
    ticket:        TicketContext          # set externally before graph.invoke()
    result_set:    list[dict]             # written by: coral_agent
    sentry_signal: SentrySignal | None   # written by: signal_agent
    slack_signal:  SlackSignal | None    # written by: signal_agent
    deploy_signal: DeploySignal | None   # written by: signal_agent
    linear_signal: LinearSignal | None   # written by: signal_agent
    brief:         TechnicalBrief | None # written by: synthesis_agent
    dispatched:    bool                  # written by: dispatch_agent
    pattern_match: dict | None           # written by: ticket_agent
```
**FROZEN after Day 2. Any field rename breaks both sides of the codebase. The TypedDict does not enforce this at runtime — mismatches only surface as KeyErrors when that path executes.**

---

## THE CORAL QUERY — THE ENTIRE VALUE PROPOSITION

This is `coral/queries.py`. Every JOIN condition encodes a business rule. Do not change time windows without understanding why they exist.

```python
MASTER_QUERY = """
SELECT
  s.issue_id           AS sentry_issue_id,
  s.title              AS error_title,
  s.culprit            AS error_culprit,
  s.level              AS error_level,
  s.times_seen         AS error_occurrences,
  s.first_seen         AS error_first_seen,
  s.last_seen          AS error_last_seen,
  s.user_count         AS affected_users,

  sl.ts                AS slack_thread_ts,
  sl.text              AS slack_message,
  sl.user              AS slack_author,
  sl.channel           AS slack_channel,

  g.sha                AS deploy_sha,
  g.created_at         AS deploy_time,
  g.description        AS deploy_description,

  l.identifier         AS linear_issue_id,
  l.title              AS linear_title,
  l.state_name         AS linear_status,
  l.assignee_name      AS linear_assignee

FROM intercom.conversations t

LEFT JOIN sentry.issues s
  ON  s.user_email  = t.contact_email
  AND s.first_seen >= DATETIME(t.created_at, '-2 hours')
  AND s.first_seen <= DATETIME(t.created_at, '+30 minutes')

LEFT JOIN slack.messages sl
  ON (sl.text LIKE '%' || SUBSTR(s.culprit, 1, 30) || '%'
   OR sl.text LIKE '%' || s.tags_service || '%')
  AND sl.ts >= DATETIME(t.created_at, '-4 hours')
  AND sl.channel IN ('#engineering', '#incidents', '#on-call')

LEFT JOIN github.deployments g
  ON  g.environment = 'production'
  AND g.created_at >= DATETIME(t.created_at, '-6 hours')
  AND g.created_at <= t.created_at

LEFT JOIN linear.issues l
  ON  l.title      LIKE '%' || SUBSTR(s.title, 1, 20) || '%'
  AND l.state_name IN ('Todo', 'In Progress', 'In Review')

WHERE  t.id = :ticket_id
LIMIT  50
"""
```

**Time window rationale (do not change without understanding):**
- Sentry `-2h/+30m`: customers don't report bugs instantly; Sentry ingestion can be delayed
- Slack `-4h`: engineers see monitoring alerts before customers write tickets
- GitHub `-6h`: deploy regressions surface slowly, not immediately
- Linear fuzzy match: engineer-written titles use plain English, not exception class names
- `SUBSTR(s.culprit, 1, 30)`: truncate to avoid overly specific matches

**CRITICAL:** The column aliases in this query (`AS sentry_issue_id`, `AS error_title`, etc.) must exactly match the keys in `mock_data/coral_result_a.json` and the `.get("key")` calls in `signal_agent.py`. These three files are a triangle — change one, change all three.

---

## AGENT IMPLEMENTATIONS — EXACT PATTERNS

### ticket_agent.py
```python
from pipeline.state import NexusState
from db import ops as db_ops

def run_ticket_agent(state: NexusState) -> dict:
    """Enriches state with SQLite history. Does NOT parse ticket — webhook handler does that."""
    ticket = state["ticket"]
    pattern = db_ops.find_similar(customer_email=ticket.customer_email, limit=3)
    return {"pattern_match": pattern}
    # Returns only the key this agent writes. Never touches ticket, result_set, etc.
```

### coral_agent.py
```python
from coral.client import coral_query
from coral.queries import MASTER_QUERY
from pipeline.state import NexusState

def run_coral_agent(state: NexusState) -> dict:
    """Executes Coral SQL. Returns raw rows. No transformation here."""
    ticket = state["ticket"]
    rows = coral_query(sql=MASTER_QUERY, params={"ticket_id": ticket.ticket_id})
    return {"result_set": rows}
    # rows is list[dict] — column aliases become dict keys
```

### signal_agent.py
```python
from models.signals import SentrySignal, SlackSignal, DeploySignal, LinearSignal
from pipeline.state import NexusState
from datetime import datetime

def run_signal_agent(state: NexusState) -> dict:
    rows = state["result_set"]
    ticket = state["ticket"]

    # SentrySignal — filter rows that have a sentry hit
    sentry_rows = [r for r in rows if r.get("sentry_issue_id")]
    if sentry_rows:
        r = sentry_rows[0]
        sentry = SentrySignal(
            found=True,
            issue_id=r["sentry_issue_id"],
            error_title=r["error_title"],
            culprit=r["error_culprit"],
            first_seen=r["error_first_seen"],
            occurrences=r.get("error_occurrences", 0),
            affected_users=r.get("affected_users", 0),
            level=r.get("error_level"),
        )
    else:
        sentry = SentrySignal(found=False, issue_id=None, error_title=None,
                              culprit=None, first_seen=None, occurrences=0,
                              affected_users=0, level=None)

    # SlackSignal
    slack_rows = [r for r in rows if r.get("slack_message")]
    slack = SlackSignal(
        found=bool(slack_rows),
        thread_count=len(slack_rows),
        earliest_mention=slack_rows[0]["slack_thread_ts"] if slack_rows else None,
        messages=[{"author": r["slack_author"], "text": r["slack_message"],
                   "ts": r["slack_thread_ts"]} for r in slack_rows],
        already_known=len(slack_rows) > 0,
    )

    # DeploySignal
    deploy_rows = [r for r in rows if r.get("deploy_sha")]
    if deploy_rows:
        r = deploy_rows[0]
        deploy_dt = datetime.fromisoformat(r["deploy_time"])
        mins_before = int((ticket.created_at - deploy_dt).total_seconds() / 60)
        deploy = DeploySignal(found=True, deploy_sha=r["deploy_sha"],
                              deploy_time=r["deploy_time"],
                              minutes_before_ticket=mins_before,
                              description=r.get("deploy_description"))
    else:
        deploy = DeploySignal(found=False, deploy_sha=None, deploy_time=None,
                              minutes_before_ticket=None, description=None)

    # LinearSignal
    linear_rows = [r for r in rows if r.get("linear_issue_id")]
    if linear_rows:
        r = linear_rows[0]
        linear = LinearSignal(found=True, issue_id=r["linear_issue_id"],
                              issue_title=r["linear_title"],
                              status=r["linear_status"],
                              assignee=r.get("linear_assignee"))
    else:
        linear = LinearSignal(found=False, issue_id=None, issue_title=None,
                              status=None, assignee=None)

    return {
        "sentry_signal": sentry,
        "slack_signal":  slack,
        "deploy_signal": deploy,
        "linear_signal": linear,
    }
```

### synthesis_agent.py
```python
import json
from anthropic import Anthropic
from models.brief import TechnicalBrief
from pipeline.state import NexusState
from db import ops as db_ops

client = Anthropic()

SYSTEM_PROMPT = """You are NEXUS, a customer escalation intelligence system.
You receive structured signals from multiple data sources and produce a TechnicalBrief.
Rules:
- Respond with valid JSON ONLY. No markdown. No backticks. No explanation.
- root_cause must be exactly one of: known_bug, service_degradation, user_error, external_dependency, unknown
- severity must be exactly one of: low, medium, high, critical
- confidence_pct must be an integer 0-100, not a string
- causal_chain must be an array of strings, each starting with a timestamp
- linear_issue_id must be null (not empty string) when no Linear issue found
- draft_customer_response must be empathetic and non-technical, max 3 sentences
- If all signals have found=false, root_cause must be user_error or unknown
- If sentry.found=true AND deploy.found=true AND deploy.minutes_before_ticket < 60, root_cause must be known_bug or service_degradation"""

def run_synthesis_agent(state: NexusState) -> dict:
    ticket  = state["ticket"]
    sentry  = state["sentry_signal"]
    slack   = state["slack_signal"]
    deploy  = state["deploy_signal"]
    linear  = state["linear_signal"]
    pattern = state.get("pattern_match")

    user_prompt = f"""Ticket: {json.dumps(ticket.__dict__, default=str)}
Sentry: {json.dumps(sentry.__dict__)}
Slack: {json.dumps(slack.__dict__)}
Deploy: {json.dumps(deploy.__dict__)}
Linear: {json.dumps(linear.__dict__)}
{"Historical context: " + json.dumps(pattern) if pattern else ""}

Produce TechnicalBrief JSON with these exact keys:
root_cause, confidence_pct, severity, affected_service, affected_users,
causal_chain (array of timestamped strings), engineer_summary (max 3 sentences, technical),
draft_customer_response (empathetic, non-technical, max 3 sentences),
recommended_action, linear_issue_id (string or null)"""

    def call_claude(prompt_override=None):
        return client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            temperature=0,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt_override or user_prompt}]
        )

    # First attempt
    try:
        response = call_claude()
        raw = response.content[0].text.strip().lstrip("```json").rstrip("```").strip()
        parsed = json.loads(raw)
        brief = TechnicalBrief(**parsed)
        db_ops.save_brief(ticket, brief)
        return {"brief": brief}
    except (json.JSONDecodeError, Exception):
        pass

    # Retry with correction prompt
    try:
        correction = f"{user_prompt}\n\nPrevious response failed JSON validation. Return ONLY valid JSON with the exact keys listed. No markdown."
        response = call_claude(correction)
        raw = response.content[0].text.strip().lstrip("```json").rstrip("```").strip()
        parsed = json.loads(raw)
        brief = TechnicalBrief(**parsed)
        db_ops.save_brief(ticket, brief)
        return {"brief": brief}
    except Exception:
        # Fallback to hardcoded brief for demo safety
        import pathlib
        fallback_path = pathlib.Path("mock_data/brief_fallback_a.json")
        if fallback_path.exists():
            brief = TechnicalBrief(**json.loads(fallback_path.read_text()))
            db_ops.save_brief(ticket, brief)
            return {"brief": brief}
        raise
```

### dispatch_agent.py
```python
from integrations.intercom import post_internal_note
from integrations.slack import post_escalation
from pipeline.state import NexusState
from config import settings
from db import ops as db_ops

def run_dispatch_agent(state: NexusState) -> dict:
    brief  = state["brief"]
    ticket = state["ticket"]

    # Always post to Intercom
    post_internal_note(ticket_id=ticket.ticket_id, brief=brief)

    # Slack: low confidence OR critical severity
    should_escalate = (
        brief.confidence_pct < settings.CONFIDENCE_THRESHOLD
        or brief.severity == "critical"
    )
    if should_escalate:
        post_escalation(ticket=ticket, brief=brief,
                        channel=settings.SLACK_ESCALATION_CHANNEL)

    db_ops.log_dispatch(ticket.ticket_id, dispatched=True)
    return {"dispatched": True}
```

---

## LANGGRAPH GRAPH (`pipeline/graph.py`)

```python
from langgraph.graph import StateGraph, START, END
from pipeline.state import NexusState
from agents.ticket_agent import run_ticket_agent
from agents.coral_agent import run_coral_agent
from agents.signal_agent import run_signal_agent
from agents.synthesis_agent import run_synthesis_agent
from agents.dispatch_agent import run_dispatch_agent

def build_graph():
    graph = StateGraph(NexusState)
    graph.add_node("ticket_agent",    run_ticket_agent)
    graph.add_node("coral_agent",     run_coral_agent)
    graph.add_node("signal_agent",    run_signal_agent)
    graph.add_node("synthesis_agent", run_synthesis_agent)
    graph.add_node("dispatch_agent",  run_dispatch_agent)
    graph.add_edge(START,             "ticket_agent")
    graph.add_edge("ticket_agent",    "coral_agent")
    graph.add_edge("coral_agent",     "signal_agent")
    graph.add_edge("signal_agent",    "synthesis_agent")
    graph.add_edge("synthesis_agent", "dispatch_agent")
    graph.add_edge("dispatch_agent",  END)
    return graph.compile()

nexus_graph = build_graph()
```

**Node function contract:** Every node function takes `state: NexusState` and returns a `dict` containing ONLY the keys that node writes. LangGraph merges this partial dict into the full state. Never return the full state. Never mutate `state` in place.

---

## FASTAPI LAYER

### webhook.py — Critical implementation notes
- Read the raw request body BEFORE calling `await request.json()`. HMAC validates against raw bytes.
- `hmac.compare_digest()` prevents timing attacks — use it, not `==`.
- `DEMO_MODE` bypass: if `X-Hub-Signature-256` header equals `"sha256=demo_bypass"`, skip HMAC. This is for curl testing and on-stage demo triggers.
- The pipeline runs in `BackgroundTasks` — the 200 response must be sent BEFORE the pipeline starts.
- Add deduplication: if `ticket_id` already exists in SQLite, skip processing to prevent Intercom retry storms.

```python
async def run_pipeline(ticket: TicketContext):
    await broadcast({"event": "started", "ticket_id": ticket.ticket_id})
    try:
        # Broadcast intermediate events within each agent using the broadcast() import
        final_state = nexus_graph.invoke({"ticket": ticket})
        await broadcast({
            "event": "completed",
            "ticket_id": ticket.ticket_id,
            "brief": final_state["brief"].dict()
        })
    except Exception as e:
        await broadcast({"event": "error", "ticket_id": ticket.ticket_id, "message": str(e)})
```

### stream.py — SSE implementation
```python
_queue: asyncio.Queue = asyncio.Queue()

async def broadcast(event: dict):
    await _queue.put(event)

async def event_generator():
    while True:
        event = await _queue.get()
        yield f"data: {json.dumps(event)}\n\n"
```
- Add `X-Accel-Buffering: no` header to disable Nginx proxy buffering.
- Every SSE event MUST include `ticket_id` so the dashboard can route events to the correct card when multiple pipelines run concurrently.
- The in-memory queue is single-instance only. Sufficient for hackathon demo.

### SSE Event Schema — Dashboard depends on these exact shapes
```
{event: "started",       ticket_id: str}
{event: "coral_done",    ticket_id: str, row_count: int}
{event: "signal_done",   ticket_id: str, signals_found: list[str]}
{event: "synthesis_done",ticket_id: str, confidence_pct: int, root_cause: str}
{event: "completed",     ticket_id: str, brief: dict}
{event: "error",         ticket_id: str, message: str}
```
**Do not add or rename these event types without updating AgentStatus.jsx simultaneously.**

---

## DATABASE LAYER

### SQLite Schema (`db/models.py`)
```sql
CREATE TABLE IF NOT EXISTS incidents (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id        TEXT    NOT NULL UNIQUE,
    customer_email   TEXT    NOT NULL,
    root_cause       TEXT    NOT NULL,
    confidence_pct   INTEGER NOT NULL,
    severity         TEXT    NOT NULL,
    affected_service TEXT,
    sentry_issue_id  TEXT,
    linear_issue_id  TEXT,
    brief_json       TEXT    NOT NULL,
    resolved_at      TEXT,
    created_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_incidents_customer ON incidents(customer_email);
CREATE INDEX IF NOT EXISTS idx_incidents_service  ON incidents(affected_service);
CREATE INDEX IF NOT EXISTS idx_incidents_cause    ON incidents(root_cause);
```
Note the `UNIQUE` constraint on `ticket_id` — this is the deduplication guard.

### ops.py function signatures — These are the interface B depends on
```python
def save_brief(ticket: TicketContext, brief: TechnicalBrief) -> None
def find_similar(customer_email: str, limit: int = 3) -> dict | None
    # Returns {"matches": [{"root_cause": ..., "confidence_pct": ..., ...}], "count": int}
    # Returns None when no history found
def get_stats(column: str) -> dict
    # Returns {value: count} — e.g. {"known_bug": 5, "user_error": 3}
def get_recent_briefs(limit: int = 20) -> list[dict]
    # Returns list of brief_json rows parsed back to dict
def log_dispatch(ticket_id: str, dispatched: bool) -> None
```

---

## INTEGRATIONS LAYER

### intercom.py
```python
def format_intercom_note(brief: TechnicalBrief) -> str:
    """Returns markdown string. Must include: severity, confidence_pct,
    numbered causal chain, engineer_summary, recommended_action, Linear link."""

def post_internal_note(ticket_id: str, brief: TechnicalBrief) -> None:
    """In DEMO_MODE: print formatted note to stdout, return None.
    In live mode: POST to https://api.intercom.io/conversations/{ticket_id}/reply"""
```

### slack.py
```python
def format_slack_escalation(brief: TechnicalBrief, ticket: TicketContext) -> list[dict]:
    """Returns Slack Block Kit blocks list. Confidence pill must be colour-coded:
    green (≥70), orange (50-69), red (<50). Include causal chain and Linear link."""

def post_message(channel: str, blocks: list[dict]) -> None:
    """In DEMO_MODE: print blocks as JSON to stdout, return None.
    In live mode: use Slack Bolt SDK WebClient.chat_postMessage()"""
```

---

## CORAL CLIENT (`coral/client.py`)

```python
import subprocess, json
from config import settings

def coral_query(sql: str, params: dict | None = None) -> list[dict]:
    if settings.DEMO_MODE:
        from coral.mock_client import mock_query
        return mock_query(params)

    final_sql = sql
    if params:
        for key, value in params.items():
            final_sql = final_sql.replace(f":{key}", f"'{value}'")

    result = subprocess.run(
        ["coral", "sql", final_sql, "--format", "json"],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        raise RuntimeError(f"Coral query failed: {result.stderr}")
    return json.loads(result.stdout)
```

```python
# coral/mock_client.py
import json
from pathlib import Path

FIXTURE_MAP = {
    "ticket_checkout": "mock_data/coral_result_a.json",
    "ticket_login":    "mock_data/coral_result_b.json",
    "ticket_payment":  "mock_data/coral_result_c.json",
}

def mock_query(params: dict) -> list[dict]:
    ticket_id = params.get("ticket_id", "ticket_checkout")
    key = ticket_id if ticket_id in FIXTURE_MAP else "ticket_checkout"
    return json.loads(Path(FIXTURE_MAP[key]).read_text())
```

---

## MOCK DATA FIXTURE COLUMN SCHEMA

All 18 column names below must appear in EVERY coral_result fixture file (as keys) and in EVERY `.get("key")` call in signal_agent.py. The queries.py AS aliases must match these exactly.

```
sentry_issue_id    error_title         error_culprit       error_level
error_occurrences  error_first_seen    error_last_seen     affected_users
slack_thread_ts    slack_message       slack_author        slack_channel
deploy_sha         deploy_time         deploy_description
linear_issue_id    linear_title        linear_status       linear_assignee
```

Scenario B (coral_result_b.json) must have ALL 18 keys present with null values — not missing keys. `signal_agent.py` uses `.get()` but the schema must be consistent.

---

## CONFIG (`config.py`)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ANTHROPIC_API_KEY:          str
    INTERCOM_ACCESS_TOKEN:      str = ""
    INTERCOM_WEBHOOK_SECRET:    str = "demo_secret"
    SLACK_BOT_TOKEN:            str = ""
    SLACK_ESCALATION_CHANNEL:   str = "#nexus-alerts"
    SENTRY_ORG_SLUG:            str = ""
    GITHUB_TOKEN:               str = ""
    LINEAR_API_KEY:             str = ""
    DEMO_MODE:                  bool = False
    CONFIDENCE_THRESHOLD:       int = 70
    DATABASE_URL:               str = "sqlite:///nexus.db"

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## REQUIREMENTS

```
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

## DEMO SCENARIOS — THE THREE STORIES

### Scenario A — Checkout Bug (coral_result_a.json)
All 4 signals populated. Deploy at 14:18, NullPointerException at 14:21 (+3 min), engineer mentions in Slack at 14:23, customer ticket at 14:38. Linear issue LIN-2847 already created. Expected output: `root_cause="known_bug"`, `confidence_pct≥88`, `severity="high"`, causal chain with 4 timestamped entries. Dispatch: Intercom only (confidence ≥70, severity not critical).

### Scenario B — False Alarm (coral_result_b.json)
All 18 column values are null. No Sentry error, no Slack thread, no deploy, no Linear issue. Customer cannot log in. Expected output: `root_cause="user_error"`, `confidence_pct≥88`, `severity="low"`, causal chain says "No technical errors detected for this user". Dispatch: Intercom only.

### Scenario C — Stripe Outage (coral_result_c.json)
No internal Sentry errors. No recent deploy. No Slack thread in engineering channels. 50 tickets arriving on payment keyword pattern. Expected output: `root_cause="external_dependency"`, `affected_service="payment-gateway"`, causal chain mentions third-party dependency. Dispatch: Intercom + Slack (either confidence <70 or severity="high").

---

## TESTING STRUCTURE

```
tests/
├── conftest.py            # mock_ticket, mock_brief, mock_signals, test client fixtures
├── test_webhook.py        # HMAC validation, 200 response, background task creation, dedup
├── test_signal_agent.py   # Scenario A (all found=True), Scenario B (all found=False), mixed
├── test_synthesis.py      # Claude mocked — test prompt construction, JSON parse, retry logic
├── test_dispatch.py       # All 4 routing branches from the decision matrix
└── test_coral_client.py   # DEMO_MODE returns fixture, real mode calls subprocess
```

### Test philosophy
- Mock the Anthropic client in test_synthesis.py — never call real Claude in tests
- Use Scenario B fixture to test the all-null path in signal_agent — this is the most likely silent bug
- Test dispatch routing matrix explicitly: confidence 71 + severity "high" → Intercom only; confidence 69 → Slack; severity "critical" → always Slack

---

## COMMON MISTAKES — DO NOT DO THESE

1. **Calling `.json()` before reading raw bytes in webhook.py.** FastAPI consumes the body stream on the first read. Store `body = await request.body()` first, then `payload = json.loads(body)`.

2. **Using `state["key"] = value` inside a node.** LangGraph state is immutable inside nodes. Return `{"key": value}` instead.

3. **Passing Signal dataclasses to json.dumps() without `.__dict__`** — dataclasses are not JSON serialisable by default. Use `json.dumps(sentry.__dict__)`.

4. **Changing a column alias in queries.py without updating mock fixtures AND signal_agent.py.** These three files form a triangle. All three must stay in sync.

5. **Setting `temperature` above 0 in synthesis_agent.** Higher temperature = more creative = less deterministic JSON = more parse failures on stage.

6. **Not including `ticket_id` in every SSE event.** When two scenarios run concurrently, the dashboard must attribute events to the correct ticket card. Without ticket_id, events get misrouted.

7. **Forgetting `X-Accel-Buffering: no` in stream.py headers.** Without this, Nginx buffers SSE and the dashboard appears frozen for 30+ seconds.

8. **Writing `linear_issue_id: ""` from Claude.** The TechnicalBrief validator converts empty string to None, but the SYSTEM_PROMPT must explicitly say "return null, not empty string" to avoid it in the first place.

9. **Building React dashboard before pipeline works end-to-end.** Get `graph.invoke()` returning a correct TechnicalBrief first. Then build the UI. A working backend with `print()` output beats a broken React dashboard.

10. **Using real APIs during the demo.** Set `DEMO_MODE=true` in `.env` before going on stage. No exceptions.

---

## VALIDATION GATES — CHECK THESE IN ORDER

Every gate must pass before moving to the next file.

```
Gate 1: uvicorn main:app starts without import errors → GET /health returns {"status":"ok","mode":"demo"}

Gate 2: python -c "from models.brief import TechnicalBrief; TechnicalBrief(root_cause='bad')"
        → raises ValidationError (pydantic enum check works)

Gate 3: DEMO_MODE=true python -c "from coral.client import coral_query; print(coral_query('SELECT 1', {'ticket_id':'ticket_checkout'})[0].keys())"
        → prints all 18 expected column names

Gate 4: python -c "from agents.signal_agent import run_signal_agent; ..."
        → Scenario B (all-null): all 4 signals have found=False, no KeyError

Gate 5: python -c "from agents.synthesis_agent import run_synthesis_agent; ..."
        → Scenario A signals: TechnicalBrief returned with root_cause="known_bug", confidence_pct is int

Gate 6: graph.invoke({"ticket": mock_ticket}) → state["brief"].confidence_pct is int, state["dispatched"] == True

Gate 7: curl -X POST /webhook/intercom -H "X-Hub-Signature-256: sha256=demo_bypass" -d @mock_data/ticket_checkout.json
        → 200 response in <100ms, brief appears in GET /history after 5s

Gate 8: GET /stream receives 5 SSE events in correct order for a triggered scenario
```

---

## ENVIRONMENT VARIABLES

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Always | — | Only external API called in DEMO_MODE |
| `DEMO_MODE` | No | `false` | Set `true` for all testing and demo |
| `INTERCOM_ACCESS_TOKEN` | Live only | — | |
| `INTERCOM_WEBHOOK_SECRET` | Live only | — | |
| `SLACK_BOT_TOKEN` | Live only | — | |
| `SLACK_ESCALATION_CHANNEL` | No | `#nexus-alerts` | |
| `SENTRY_ORG_SLUG` | Live only | — | Coral uses this |
| `GITHUB_TOKEN` | Live only | — | Coral uses this |
| `LINEAR_API_KEY` | Live only | — | Coral uses this |
| `CONFIDENCE_THRESHOLD` | No | `70` | Below this → Slack escalation |
| `DATABASE_URL` | No | `sqlite:///nexus.db` | |

---

## CORAL SETUP (Live Mode Only)

```bash
brew install withcoral/tap/coral   # macOS
# or: cargo install coral-cli      # from source

coral source add intercom          # prompts for API token
coral source add sentry            # prompts for auth token + org slug
coral source add slack             # prompts for bot token
coral source add github            # prompts for personal access token
coral source add linear            # prompts for API key

coral source list                  # verify all 5 show green status
coral sql "SELECT * FROM sentry.issues LIMIT 1"   # smoke test each source
```

**After adding real sources:** Run the MASTER_QUERY and compare actual column names against the 18 expected aliases. Fix queries.py aliases if they differ, then update mock fixtures to match.

---

## ARCHITECTURE DECISION LOG

| Decision | Why |
|---|---|
| Coral as only data layer | Adding a new source = new agent only. No integration code changes. |
| Sequential LangGraph, no parallel | Every state field has one writer. Debuggable at every node. No reducer complexity. |
| DEMO_MODE flag in config | Live APIs are unreliable on stage. Mock fixtures tell a better, faster story. |
| `found: bool` on all Signals | Forces explicit handling of missing data. Claude never receives ambiguous None. |
| Pydantic TechnicalBrief | Fail loudly on schema mismatch. ValidationError triggers retry before crash. |
| SQLite not Postgres | Zero-config. Runs on demo machine. No server process needed. |
| SSE not WebSocket | Unidirectional server push. EventSource auto-reconnects. No WS complexity. |
| temperature=0 in Claude call | Maximum determinism for structured JSON output on stage. |
| BackgroundTask in webhook | Intercom has 10s response timeout. Pipeline takes 5-30s. Must be async. |
| ticket_id UNIQUE in SQLite | Intercom retries on non-200. Dedup prevents double processing. |