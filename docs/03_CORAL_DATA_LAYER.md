# NEXUS — Coral SQL & Data Layer

> The master cross-source query, signal schema, and everything that makes the data layer non-trivial

---

## The Core Insight

Every data source NEXUS touches — Sentry, Slack, GitHub, Linear — has its own auth protocol, pagination scheme, rate limits, and response format. Without Coral, building NEXUS means five independent Python integrations. With Coral, it means one SQL string and one subprocess call.

The master query is not boilerplate. Every JOIN condition encodes a domain decision about how to correlate technical signals with a customer complaint.

---

## The Master Coral SQL Query

```sql
-- coral/queries.py

MASTER_QUERY = """
SELECT
  -- Sentry: error for this specific customer in the failure window
  s.issue_id           AS sentry_issue_id,
  s.title              AS error_title,
  s.culprit            AS error_culprit,
  s.level              AS error_level,
  s.times_seen         AS error_occurrences,
  s.first_seen         AS error_first_seen,
  s.last_seen          AS error_last_seen,
  s.user_count         AS affected_users,

  -- Slack: engineering threads mentioning this error or service
  sl.ts                AS slack_thread_ts,
  sl.text              AS slack_message,
  sl.user              AS slack_author,
  sl.channel           AS slack_channel,

  -- GitHub: recent production deploys that may have caused this
  g.sha                AS deploy_sha,
  g.created_at         AS deploy_time,
  g.description        AS deploy_description,

  -- Linear: existing open bugs matching this error
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

---

## JOIN Logic — Why Each Condition Exists

### Intercom → Sentry JOIN
```sql
ON  s.user_email  = t.contact_email
AND s.first_seen >= DATETIME(t.created_at, '-2 hours')
AND s.first_seen <= DATETIME(t.created_at, '+30 minutes')
```

**`user_email = contact_email`** — The identity bridge. Sentry tracks errors by the email passed to `Sentry.setUser()`. Intercom stores the customer's contact email. These must match. If a company uses anonymous user IDs instead of emails in Sentry, this JOIN returns nothing — a known limitation.

**`-2 hours` / `+30 minutes` window** — A customer reporting a bug rarely does so the instant it hits them. The `-2h` window captures errors they may have been experiencing before deciding to contact support. The `+30m` forward window handles the case where Sentry's error ingestion is delayed.

---

### Sentry → Slack JOIN
```sql
ON (sl.text LIKE '%' || SUBSTR(s.culprit, 1, 30) || '%'
 OR sl.text LIKE '%' || s.tags_service || '%')
AND sl.ts >= DATETIME(t.created_at, '-4 hours')
AND sl.channel IN ('#engineering', '#incidents', '#on-call')
```

**`culprit` fuzzy match** — `s.culprit` is Sentry's `file:function` string (e.g., `PaymentService.java:processCheckout`). Truncating to 30 chars avoids overly specific matches while keeping enough signal. Engineers in Slack often write "PaymentService is throwing NPEs" — not the exact culprit string.

**`tags_service` alternative** — Sentry lets teams tag errors with a `service` tag (e.g., `payment-api`). This second OR condition catches Slack mentions of the service name when engineers don't quote the exact error.

**`-4 hours` window** — Engineers often discuss an issue in Slack before a customer ticket arrives (they saw it in monitoring first). The 4h lookback captures those conversations.

**Channel filtering** — Limits to engineering-relevant channels. Without this, a Slack workspace with hundreds of channels would return noise.

---

### Intercom → GitHub JOIN
```sql
ON  g.environment = 'production'
AND g.created_at >= DATETIME(t.created_at, '-6 hours')
AND g.created_at <= t.created_at
```

**`environment = 'production'`** — Staging and dev deploys are irrelevant. Only production deploys can cause customer-facing issues.

**`-6 hours` / `<= created_at`** — Deploy-induced bugs often surface minutes to hours after the deploy, not instantly. 6 hours covers most deployment-related regression windows. The `<= created_at` upper bound ensures only deploys *before* the ticket are considered — a deploy after the ticket can't have caused it.

**Why not JOIN GitHub to Sentry?** — The error may be a regression from a deploy that doesn't directly reference the service. Joining deploy time to the ticket time (not the error time) catches more cases.

---

### Sentry → Linear JOIN
```sql
ON  l.title      LIKE '%' || SUBSTR(s.title, 1, 20) || '%'
AND l.state_name IN ('Todo', 'In Progress', 'In Review')
```

**Title fuzzy match** — Linear issue titles are written by engineers in plain English. Sentry error titles are exception class names. `SUBSTR(s.title, 1, 20)` extracts the most distinctive part (e.g., `NullPointerException` → `NullPointerException`). The fuzzy match finds issues an engineer already filed with a human-readable title containing the same keywords.

**`state_name IN (...)` filter** — Only open bugs are relevant. `Done` and `Cancelled` issues mean the bug was fixed — if Sentry is still firing, the fix didn't work, which is itself a signal worth noting but not linked as the cause.

---

## Coral Client Implementation

```python
# coral/client.py

import subprocess
import json
from config import settings

def coral_query(sql: str, params: dict | None = None) -> list[dict]:
    """Execute a Coral SQL query. Returns list of row dicts."""
    if settings.DEMO_MODE:
        from coral.mock_client import mock_query
        return mock_query(params)

    # Substitute named params manually (Coral CLI doesn't support :param syntax natively)
    final_sql = sql
    if params:
        for key, value in params.items():
            final_sql = final_sql.replace(f":{key}", f"'{value}'")

    result = subprocess.run(
        ['coral', 'sql', final_sql, '--format', 'json'],
        capture_output=True,
        text=True,
        timeout=30
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
    fixture_key = ticket_id if ticket_id in FIXTURE_MAP else "ticket_checkout"
    fixture_path = Path(FIXTURE_MAP[fixture_key])
    return json.loads(fixture_path.read_text())
```

---

## Signal Object Schema

All four Signal objects are Python `@dataclass` with `found: bool` as the mandatory first field. This pattern is critical — the LLM prompt always receives a well-formed object, never a raw `None` or empty dict.

### SentrySignal
```python
@dataclass
class SentrySignal:
    found:          bool
    issue_id:       str | None   # Sentry internal ID
    error_title:    str | None   # Exception class name
    culprit:        str | None   # file:function (e.g. PaymentService.java:142)
    first_seen:     str | None   # ISO timestamp
    occurrences:    int          # times_seen — breadth of impact
    affected_users: int          # unique users — severity proxy
    level:          str | None   # fatal | error | warning
```

### SlackSignal
```python
@dataclass
class SlackSignal:
    found:            bool
    thread_count:     int
    earliest_mention: str | None              # ISO timestamp
    messages:         list[dict]              # [{author, text, ts, channel}]
    already_known:    bool                    # True = engineers already on it
```

### DeploySignal
```python
@dataclass
class DeploySignal:
    found:                 bool
    deploy_sha:            str | None
    deploy_time:           str | None         # ISO timestamp
    minutes_before_ticket: int | None         # causal proximity indicator
    description:           str | None         # commit message / tag
```

### LinearSignal
```python
@dataclass
class LinearSignal:
    found:       bool
    issue_id:    str | None   # e.g. LIN-2847
    issue_title: str | None
    status:      str | None   # Todo | In Progress | In Review
    assignee:    str | None
```

---

## TechnicalBrief Schema

```python
# models/brief.py

from pydantic import BaseModel

class TechnicalBrief(BaseModel):
    root_cause:              str    # known_bug | service_degradation | user_error
                                   # | external_dependency | unknown
    confidence_pct:          int    # 0-100 — dispatch routing key
    severity:                str    # low | medium | high | critical
    affected_service:        str
    affected_users:          int
    causal_chain:            list[str]   # timestamped evidence steps
    engineer_summary:        str    # max 3 sentences, technical
    draft_customer_response: str    # empathetic, non-technical
    recommended_action:      str    # next step for support agent
    linear_issue_id:         str | None  # e.g. LIN-2847
```

**Pydantic validation** means if Claude returns a field with the wrong type (e.g. `confidence_pct` as a string `"87"` instead of `87`), Pydantic will attempt coercion first and raise `ValidationError` if it fails. This is caught in `synthesis_agent.py` and triggers a retry.

---

## SQLite Schema

```sql
-- db/models.py

CREATE TABLE incidents (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id        TEXT    NOT NULL,
    customer_email   TEXT    NOT NULL,
    root_cause       TEXT    NOT NULL,  -- known_bug | service_degradation | ...
    confidence_pct   INTEGER NOT NULL,
    severity         TEXT    NOT NULL,  -- low | medium | high | critical
    affected_service TEXT,
    sentry_issue_id  TEXT,              -- nullable — no Sentry match is valid
    linear_issue_id  TEXT,              -- nullable — e.g. LIN-2847
    brief_json       TEXT    NOT NULL,  -- full TechnicalBrief serialised as JSON
    resolved_at      TEXT,              -- nullable ISO timestamp
    created_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_incidents_customer ON incidents(customer_email);
CREATE INDEX idx_incidents_service  ON incidents(affected_service);
CREATE INDEX idx_incidents_cause    ON incidents(root_cause);
```

**Why store `brief_json`?** — The full `TechnicalBrief` is stored as a JSON string alongside the extracted scalar fields. This allows:
1. Pattern matching queries using the indexed scalar columns (fast)
2. Full brief retrieval for the dashboard without re-running the pipeline (cheap)

**Index design** — Three indexes cover the three query patterns:
- `customer_email` — "has this customer had this issue before?"
- `affected_service` — "which service causes the most tickets?"
- `root_cause` — "what % of tickets are known bugs vs user errors?"

---

## Dispatch Routing Logic

```python
# agents/dispatch_agent.py

CONFIDENCE_THRESHOLD = settings.CONFIDENCE_THRESHOLD  # default: 70

def dispatch(brief: TechnicalBrief, ticket: TicketContext):

    # 1. Always post Intercom internal note
    note_body = format_intercom_note(brief)
    intercom.post_internal_note(ticket_id=ticket.ticket_id, body=note_body)

    # 2. Slack escalation: low confidence OR critical severity
    if brief.confidence_pct < CONFIDENCE_THRESHOLD or brief.severity == "critical":
        slack_body = format_slack_escalation(brief, ticket)
        slack.post_message(
            channel=settings.SLACK_ESCALATION_CHANNEL,
            blocks=slack_body
        )

    # 3. Linear link injection: known bug with a tracked issue
    # (handled inside format_intercom_note and format_slack_escalation)
    # if brief.root_cause == "known_bug" and brief.linear_issue_id:
    #     → inject Linear URL into both outputs automatically

    db_ops.log_dispatch(ticket_id=ticket.ticket_id, dispatched=True)
```

### Routing Decision Matrix

| `confidence_pct` | `severity` | `root_cause` | Intercom | Slack |
|---|---|---|---|---|
| ≥ 70 | any except critical | any | ✓ | ✗ |
| ≥ 70 | critical | any | ✓ | ✓ |
| < 70 | any | any | ✓ | ✓ |
| any | any | known_bug | ✓ + Linear link | (if triggered) |

---

## Mock Data Fixture Structure

Each mock fixture is a `list[dict]` matching the SQL column aliases exactly. This ensures the real pipeline and the demo pipeline process identical data shapes.

```json
// mock_data/coral_result_a.json — Scenario A (Checkout Bug)
[
  {
    "sentry_issue_id": "SENT-4721",
    "error_title": "NullPointerException",
    "error_culprit": "PaymentService.java:processCheckout",
    "error_level": "error",
    "error_occurrences": 1203,
    "error_first_seen": "2025-05-10T14:21:00",
    "error_last_seen": "2025-05-10T14:38:00",
    "affected_users": 847,
    "slack_thread_ts": "2025-05-10T14:23:00",
    "slack_message": "seeing some payment errors, investigating",
    "slack_author": "alice",
    "slack_channel": "#engineering",
    "deploy_sha": "a3f8c12",
    "deploy_time": "2025-05-10T14:18:00",
    "deploy_description": "refactor: payment gateway timeout handling",
    "linear_issue_id": "LIN-2847",
    "linear_title": "Payment checkout failing with NPE on timeout",
    "linear_status": "In Progress",
    "linear_assignee": "alice"
  }
]
```

```json
// mock_data/coral_result_b.json — Scenario B (False Alarm)
[
  {
    "sentry_issue_id": null,
    "error_title": null,
    "error_culprit": null,
    "error_level": null,
    "error_occurrences": 0,
    "error_first_seen": null,
    "error_last_seen": null,
    "affected_users": 0,
    "slack_thread_ts": null,
    "slack_message": null,
    "slack_author": null,
    "slack_channel": null,
    "deploy_sha": null,
    "deploy_time": null,
    "deploy_description": null,
    "linear_issue_id": null,
    "linear_title": null,
    "linear_status": null,
    "linear_assignee": null
  }
]
```

An all-null row in Scenario B is what makes the `SignalAgent` produce four `found=False` Signal objects, which then causes `SynthesisAgent` to classify as `user_error` with high confidence. The fixture structure is the source of truth for the demo story.
