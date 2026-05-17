# NEXUS — System Architecture

> Customer Escalation Intelligence Agent · Built on Coral Protocol

---

## Overview

NEXUS is a **sequential multi-agent pipeline** that transforms an incoming support ticket into a structured technical diagnosis in under 30 seconds. It does this by executing a single cross-source SQL JOIN across five external APIs (Intercom, Sentry, Slack, GitHub, Linear) via Coral Protocol, synthesising the result through Claude, and dispatching a `TechnicalBrief` to the right destination based on confidence thresholds.

The architectural complexity of NEXUS lives in three places:

1. **Cross-source data federation** — one SQL query replacing five independent API integrations
2. **Typed signal transformation pipeline** — raw tabular rows → structured Python dataclasses → LLM prompt
3. **Confidence-gated routing** — deterministic dispatch logic that decides where output goes

---

## Four-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      TRIGGER LAYER                          │
│  Intercom webhook → FastAPI /webhook/intercom               │
│  HMAC validation → TicketContext → async background task    │
└──────────────────────────┬──────────────────────────────────┘
                           │ TicketContext
┌──────────────────────────▼──────────────────────────────────┐
│                   INTELLIGENCE LAYER                        │
│                                                             │
│  CoralAgent → cross-source SQL (5 LEFT JOINs)               │
│       │                                                     │
│       ▼ raw result set (list[dict])                         │
│  SignalAgent → SentrySignal, SlackSignal,                   │
│                DeploySignal, LinearSignal                   │
│       │                                                     │
│       ▼ 4x typed dataclasses as JSON                        │
│  SynthesisAgent (Claude claude-sonnet-4-6)                  │
│       │                                                     │
│       ▼ TechnicalBrief                                      │
│  DispatchAgent → confidence threshold routing               │
└──────────────────────────┬──────────────────────────────────┘
                           │ TechnicalBrief
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ STORAGE LAYER │  │  PRESENTATION │  │  PRESENTATION │
│               │  │    LAYER A    │  │    LAYER B    │
│ SQLite        │  │               │  │               │
│ incidents     │  │ Intercom      │  │ Slack         │
│ table         │  │ internal note │  │ #nexus-alerts │
│               │  │               │  │               │
│ - brief_json  │  │ Always posted │  │ If confidence │
│ - patterns    │  │ (≥ 70% conf.) │  │ < 70% OR      │
│ - history     │  │               │  │ critical sev. │
└───────────────┘  └───────────────┘  └───────────────┘
```

---

## Agent Pipeline — Detailed

### Agent 1: TicketAgent

**Responsibility:** Parse raw Intercom webhook JSON into a typed `TicketContext`.

**Complexity:** HMAC-SHA256 signature validation. Must verify `X-Hub-Signature-256` header against the raw request body before any parsing. Also performs a SQLite lookup for historical patterns on the same `customer_email` — injecting prior resolution history into the NexusState before the pipeline proceeds.

**Input:** Raw webhook `dict` from Intercom

**Output:** `TicketContext(ticket_id, customer_email, message_body, created_at, priority, tags)` + optional `pattern_match` from SQLite

---

### Agent 2: CoralAgent

**Responsibility:** Execute the master cross-source SQL query via Coral Protocol.

**Complexity:** This is the architectural centrepiece. A single parameterised SQL query with 4 `LEFT JOIN`s across `intercom.conversations`, `sentry.issues`, `slack.messages`, `github.deployments`, and `linear.issues`. Coral handles OAuth, pagination, rate limiting, and result caching across all five services. The agent abstracts over two execution modes: real (`subprocess.run(['coral', 'sql', ...])`) and demo (`mock_client.py` reads JSON fixtures).

**Input:** `TicketContext` (specifically `ticket_id` as the query parameter)

**Output:** `list[dict]` — raw tabular result rows with aliased column names

**Time window logic:**
- Sentry: `first_seen` within `-2h` to `+30m` of `created_at`
- Slack: message `ts` within `-4h` of `created_at`
- GitHub: deploy `created_at` within `-6h` of `created_at` (production only)
- Linear: open issues with title fuzzy match to Sentry error title

---

### Agent 3: SignalAgent

**Responsibility:** Transform raw tabular rows into 4 typed Python dataclasses.

**Complexity:** Each Signal dataclass has a `found: bool` guard — the agent must gracefully handle `None` values for any JOIN that returned no match (e.g. no Sentry error means `SentrySignal(found=False, issue_id=None, ...)`). Avoids passing `None` or `{}` to the LLM — an explicit typed object with `found=False` is far more reliable for structured JSON prompting.

**Input:** `list[dict]` raw result set

**Output:** `SentrySignal`, `SlackSignal`, `DeploySignal`, `LinearSignal`

---

### Agent 4: SynthesisAgent (Claude)

**Responsibility:** Reason over all 4 Signal objects and produce a `TechnicalBrief`.

**Complexity:** Prompt engineering for deterministic JSON output. System prompt constrains Claude to return valid JSON only with a fixed key schema — no markdown fences, no explanation. The prompt passes all 4 signals as serialised JSON objects. Output is parsed with `json.loads()` and validated against the `TechnicalBrief` Pydantic model. On parse failure, retries once with an explicit correction prompt before raising.

**Input:** 4x Signal dataclasses serialised as JSON + original `TicketContext`

**Output:** `TechnicalBrief(root_cause, confidence_pct, severity, affected_service, affected_users, causal_chain, engineer_summary, draft_customer_response, recommended_action, linear_issue_id)`

---

### Agent 5: DispatchAgent

**Responsibility:** Route `TechnicalBrief` to the correct output destinations.

**Complexity:** Three-way routing logic:
1. `confidence_pct >= 70` → POST internal note to Intercom ticket only
2. `confidence_pct < 70` OR `severity == 'critical'` → Intercom internal note + Slack escalation to `#nexus-alerts`
3. `root_cause == 'known_bug'` → inject Linear issue link (`linear_issue_id`) into both outputs

All dispatch results are logged back to SQLite.

**Input:** `TechnicalBrief` + routing config from `config.py`

**Output:** Intercom note, optional Slack message, SQLite log entry

---

## LangGraph State Graph

```
NexusState (TypedDict)
├── ticket: TicketContext
├── result_set: list[dict]
├── sentry_signal: SentrySignal | None
├── slack_signal: SlackSignal | None
├── deploy_signal: DeploySignal | None
├── linear_signal: LinearSignal | None
├── brief: TechnicalBrief | None
├── dispatched: bool
└── pattern_match: dict | None

Graph edges (sequential, no branching):
  START → ticket_agent → coral_agent → signal_agent
        → synthesis_agent → dispatch_agent → END
```

No parallel branches in the hackathon build. This is intentional — sequential pipelines are debuggable at every step via state inspection.

---

## Key Architectural Decisions

| Decision | Rationale |
|---|---|
| Coral as the only data access layer | Zero agent changes when adding a new source. SQL is the integration contract. |
| Sequential over parallel agents | Predictable state, debuggable at every node, no reducer complexity |
| DEMO_MODE flag in config.py | Never touch live APIs on stage. Mock fixtures tell a better story. |
| Typed Signal dataclasses | Prevents `None` leaking into LLM prompt. `found: bool` forces explicit handling. |
| `TechnicalBrief` Pydantic validation | Parse Claude output through Pydantic — fail loudly on schema mismatch, not silently |
| SSE for dashboard updates | No WebSocket complexity. One event per agent node transition is enough for a demo. |
| SQLite not Postgres | Zero-config, zero-infra, runs on the demo machine without a running server |
