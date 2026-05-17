# NEXUS — Agent Pipeline & LangGraph Design

> Deep dive into the 5-agent sequential pipeline, NexusState schema, and LangGraph wiring

---

## Why LangGraph

LangGraph is used for two things NEXUS actually needs:

1. **Shared typed state** — every agent reads from and writes to `NexusState`. No function passing objects around manually. No global variables.
2. **Node-level checkpointing** — in dev, you can inspect the state snapshot after any node. You can see exactly what `CoralAgent` returned before `SignalAgent` ran.

The hackathon build does not use conditional edges, parallel branches, or human-in-the-loop. The graph is a straight line. That is not a limitation — it is the correct architecture for a sequential cause-effect pipeline.

---

## NexusState TypedDict

```python
# pipeline/state.py

from typing import TypedDict
from models.ticket import TicketContext
from models.signals import SentrySignal, SlackSignal, DeploySignal, LinearSignal
from models.brief import TechnicalBrief

class NexusState(TypedDict):
    ticket:         TicketContext          # written by: ticket_agent
    result_set:     list[dict]             # written by: coral_agent
    sentry_signal:  SentrySignal | None    # written by: signal_agent
    slack_signal:   SlackSignal | None     # written by: signal_agent
    deploy_signal:  DeploySignal | None    # written by: signal_agent
    linear_signal:  LinearSignal | None    # written by: signal_agent
    brief:          TechnicalBrief | None  # written by: synthesis_agent
    dispatched:     bool                   # written by: dispatch_agent
    pattern_match:  dict | None            # written by: ticket_agent (SQLite lookup)
```

**No `Annotated` reducers.** Every key has exactly one writer. The sequential pipeline guarantees this — `coral_agent` runs after `ticket_agent`, never concurrently. If you add parallel branches later, you will need `Annotated[list[str], operator.add]` on any key with multiple writers.

---

## Graph Definition

```python
# pipeline/graph.py

from langgraph.graph import StateGraph, START, END
from pipeline.state import NexusState
from agents.ticket_agent import run_ticket_agent
from agents.coral_agent import run_coral_agent
from agents.signal_agent import run_signal_agent
from agents.synthesis_agent import run_synthesis_agent
from agents.dispatch_agent import run_dispatch_agent

def build_graph() -> StateGraph:
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

Each node function signature follows the LangGraph convention:

```python
def run_coral_agent(state: NexusState) -> dict:
    """Returns a partial state update — only keys this agent writes."""
    result_set = coral_client.query(MASTER_QUERY, ticket_id=state["ticket"].ticket_id)
    return {"result_set": result_set}
```

Returning a `dict` with only the keys you write is correct. LangGraph merges this into the state. Never mutate `state` directly inside a node.

---

## Agent Implementations

### ticket_agent.py

```python
def run_ticket_agent(state: NexusState) -> dict:
    # State at entry: only `ticket` is pre-populated (set by webhook handler)
    ticket = state["ticket"]

    # Historical pattern lookup
    pattern = db_ops.find_similar(
        customer_email=ticket.customer_email,
        limit=3
    )

    return {"pattern_match": pattern}
    # Does NOT rewrite `ticket` — it was set externally before graph.invoke()
```

**Complexity note:** `graph.invoke({"ticket": ticket_context})` pre-populates the `ticket` key before the graph starts. `ticket_agent` only adds `pattern_match`. This separation is intentional — the webhook handler owns ticket parsing, the agent owns enrichment.

---

### coral_agent.py

```python
from coral.client import coral_query   # real or mock depending on DEMO_MODE
from coral.queries import MASTER_QUERY

def run_coral_agent(state: NexusState) -> dict:
    ticket = state["ticket"]

    rows = coral_query(
        sql=MASTER_QUERY,
        params={"ticket_id": ticket.ticket_id}
    )
    # rows: list[dict] — column aliases from SQL become dict keys
    # e.g. [{"sentry_issue_id": "...", "error_title": "...", "slack_message": None, ...}]

    return {"result_set": rows}
```

**Complexity note:** The Coral subprocess call blocks. FastAPI runs this as a background task (`BackgroundTasks.add_task(graph.invoke, ...)`), so the webhook endpoint returns `200` immediately while the graph runs asynchronously.

---

### signal_agent.py

```python
from models.signals import SentrySignal, SlackSignal, DeploySignal, LinearSignal
from datetime import datetime

def run_signal_agent(state: NexusState) -> dict:
    rows = state["result_set"]
    ticket = state["ticket"]

    # --- SentrySignal ---
    sentry_rows = [r for r in rows if r.get("sentry_issue_id")]
    if sentry_rows:
        r = sentry_rows[0]  # take the most recent / highest count
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

    # --- SlackSignal ---
    slack_rows = [r for r in rows if r.get("slack_message")]
    slack = SlackSignal(
        found=bool(slack_rows),
        thread_count=len(slack_rows),
        earliest_mention=slack_rows[0]["slack_thread_ts"] if slack_rows else None,
        messages=[{"author": r["slack_author"], "text": r["slack_message"],
                   "ts": r["slack_thread_ts"]} for r in slack_rows],
        already_known=len(slack_rows) > 0,
    )

    # --- DeploySignal ---
    deploy_rows = [r for r in rows if r.get("deploy_sha")]
    if deploy_rows:
        r = deploy_rows[0]
        deploy_dt = datetime.fromisoformat(r["deploy_time"])
        mins_before = int((ticket.created_at - deploy_dt).total_seconds() / 60)
        deploy = DeploySignal(
            found=True,
            deploy_sha=r["deploy_sha"],
            deploy_time=r["deploy_time"],
            minutes_before_ticket=mins_before,
            description=r.get("deploy_description"),
        )
    else:
        deploy = DeploySignal(found=False, deploy_sha=None, deploy_time=None,
                              minutes_before_ticket=None, description=None)

    # --- LinearSignal ---
    linear_rows = [r for r in rows if r.get("linear_issue_id")]
    if linear_rows:
        r = linear_rows[0]
        linear = LinearSignal(
            found=True,
            issue_id=r["linear_issue_id"],
            issue_title=r["linear_title"],
            status=r["linear_status"],
            assignee=r.get("linear_assignee"),
        )
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

---

### synthesis_agent.py

```python
import json
from anthropic import Anthropic
from models.brief import TechnicalBrief
from config import settings

client = Anthropic()

SYSTEM_PROMPT = """You are NEXUS, a customer escalation intelligence system.
You receive structured signals from multiple data sources and produce
a TechnicalBrief that a support engineer can act on immediately.
Always respond with valid JSON only. No markdown. No explanation outside JSON."""

def run_synthesis_agent(state: NexusState) -> dict:
    ticket  = state["ticket"]
    sentry  = state["sentry_signal"]
    slack   = state["slack_signal"]
    deploy  = state["deploy_signal"]
    linear  = state["linear_signal"]
    pattern = state.get("pattern_match")

    user_prompt = f"""
Ticket: {json.dumps(ticket.__dict__, default=str)}
Sentry: {json.dumps(sentry.__dict__)}
Slack:  {json.dumps(slack.__dict__)}
Deploy: {json.dumps(deploy.__dict__)}
Linear: {json.dumps(linear.__dict__)}
{"Historical pattern: " + json.dumps(pattern) if pattern else ""}

Produce a TechnicalBrief JSON with keys:
  root_cause, confidence_pct, severity, affected_service, affected_users,
  causal_chain (array of timestamped strings), engineer_summary (max 3 sentences),
  draft_customer_response, recommended_action, linear_issue_id (str or null)
"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}]
    )

    raw = response.content[0].text
    parsed = json.loads(raw)
    brief = TechnicalBrief(**parsed)

    # Persist to SQLite immediately
    db_ops.save_brief(ticket, brief)

    return {"brief": brief}
```

---

### dispatch_agent.py

```python
from integrations.intercom import post_internal_note
from integrations.slack import post_escalation
from config import settings

def run_dispatch_agent(state: NexusState) -> dict:
    brief  = state["brief"]
    ticket = state["ticket"]

    # Always post to Intercom
    post_internal_note(
        ticket_id=ticket.ticket_id,
        brief=brief
    )

    # Slack: low confidence OR critical severity
    if brief.confidence_pct < settings.CONFIDENCE_THRESHOLD or brief.severity == "critical":
        post_escalation(
            ticket=ticket,
            brief=brief,
            channel=settings.SLACK_ESCALATION_CHANNEL
        )

    db_ops.log_dispatch(ticket.ticket_id, dispatched=True)

    return {"dispatched": True}
```

---

## State Mutation Trace — Scenario A (Checkout Bug)

```
graph.invoke({"ticket": TicketContext(id="ic_001", email="user@co.com", ...)})

After ticket_agent:
  state.ticket        = TicketContext(...)
  state.pattern_match = {"root_cause": "service_degradation", "count": 2}  ← from SQLite

After coral_agent:
  state.result_set = [
    {"sentry_issue_id": "SENT-847", "error_title": "NullPointerException", 
     "error_culprit": "PaymentService.java:142", "affected_users": 847,
     "slack_message": "seeing some payment errors, investigating",
     "deploy_sha": "a3f8c12", "deploy_time": "2025-05-10T14:18:00", ...}
  ]

After signal_agent:
  state.sentry_signal  = SentrySignal(found=True, occurrences=1203, affected_users=847, ...)
  state.slack_signal   = SlackSignal(found=True, thread_count=1, already_known=True, ...)
  state.deploy_signal  = DeploySignal(found=True, minutes_before_ticket=17, ...)
  state.linear_signal  = LinearSignal(found=True, issue_id="LIN-2847", status="In Progress", ...)

After synthesis_agent:
  state.brief = TechnicalBrief(
    root_cause="known_bug",
    confidence_pct=94,
    severity="high",
    affected_service="PaymentService",
    affected_users=847,
    causal_chain=[
      "14:18 — deploy a3f8c12 pushed to production",
      "14:21 — NullPointerException at PaymentService.java:142 (847 users)",
      "14:23 — engineer flagged in #engineering: 'seeing payment errors'",
      "14:38 — customer ticket received"
    ],
    linear_issue_id="LIN-2847",
    ...
  )

After dispatch_agent:
  state.dispatched = True
  → Intercom internal note posted ✓
  → Slack skipped (confidence 94% > threshold 70%) ✓
```

---

## LangGraph State Issues to Watch

| Issue | Where it hits NEXUS | Mitigation |
|---|---|---|
| Silent key overwrite | Not a risk — one writer per key | Sequential pipeline + TypedDict naming |
| `None` leaking into Claude prompt | Signal fields default `None` | `found: bool` guard on all Signal dataclasses |
| Subgraph schema mismatch | No subgraphs used | N/A for hackathon build |
| Blocking Coral subprocess | Graph blocks until Coral returns | Graph.invoke() runs as FastAPI BackgroundTask |
| Claude JSON parse failure | synthesis_agent crashes | Retry once with correction prompt before raising |
