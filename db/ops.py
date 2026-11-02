"""All database operations for NEXUS."""

import json

from db.session import get_session
from config import settings


def ticket_exists(ticket_id: str) -> bool:
    """
    Returns True if this ticket_id has already been processed.
    Called by api/webhook.py for deduplication before scheduling pipeline.
    """
    with get_session() as db:
        row = db.execute(
            "SELECT 1 FROM incidents WHERE ticket_id = ? LIMIT 1",
            (ticket_id,),
        ).fetchone()
    return row is not None


def save_brief(ticket, brief) -> None:
    """
    Persists a processed TechnicalBrief to SQLite.
    Called by agents/synthesis_agent.py after successful Claude synthesis.
    Uses INSERT OR IGNORE - safe to call twice on the same ticket_id.
    """
    with get_session() as db:
        inserted = db.execute(
            """INSERT OR IGNORE INTO incidents
               (ticket_id, customer_email, root_cause, confidence_pct,
                severity, affected_service, linear_issue_id, brief_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                ticket.ticket_id,
                ticket.customer_email,
                brief.root_cause,
                brief.confidence_pct,
                brief.severity,
                brief.affected_service,
                brief.linear_issue_id,
                json.dumps(brief.model_dump()),
            ),
        )
        if not inserted.rowcount:
            return
        db.execute(
            """INSERT OR IGNORE INTO ticket_reviews
               (ticket_id, environment, message_body, received_at) VALUES (?, ?, ?, ?)""",
            (ticket.ticket_id, "demo" if settings.DEMO_MODE else "live",
             ticket.message_body, ticket.created_at.isoformat()),
        )


def find_similar(customer_email: str, limit: int = 3) -> dict | None:
    """
    Returns historical incidents for this customer email.
    Called by agents/ticket_agent.py to enrich state with pattern context.
    Returns None when no history found - callers must handle None.
    """
    with get_session() as db:
        rows = db.execute(
            """SELECT root_cause, confidence_pct, affected_service, created_at
               FROM incidents
               WHERE customer_email = ?
               ORDER BY created_at DESC
               LIMIT ?""",
            (customer_email, limit),
        ).fetchall()
    if not rows:
        return None
    return {
        "matches": [dict(r) for r in rows],
        "count": len(rows),
    }


def log_dispatch(ticket_id: str, dispatched: bool) -> None:
    """
    Marks ticket as dispatched and records resolved_at timestamp.
    Called by agents/dispatch_agent.py after posting to Intercom/Slack.
    """
    with get_session() as db:
        db.execute(
            """UPDATE incidents
               SET dispatched = ?, resolved_at = CURRENT_TIMESTAMP
               WHERE ticket_id = ?""",
            (1 if dispatched else 0, ticket_id),
        )


def get_recent_briefs(limit: int = 20) -> list[dict]:
    """
    Returns most recent briefs as parsed dicts for GET /history.
    Called by api/history.py.
    """
    with get_session() as db:
        rows = db.execute(
            """SELECT i.ticket_id, i.customer_email, i.root_cause, i.confidence_pct,
                      i.severity, i.affected_service, i.brief_json, i.created_at,
                      r.environment, r.message_body, r.received_at,
                      r.resolved_at AS review_resolved_at
               FROM incidents i LEFT JOIN ticket_reviews r ON i.ticket_id = r.ticket_id
               ORDER BY COALESCE(r.received_at, i.created_at) DESC, i.id DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()
        actions = db.execute("SELECT * FROM review_actions ORDER BY created_at").fetchall()
    by_ticket = {}
    for action in actions:
        by_ticket.setdefault(action["ticket_id"], []).append(dict(action))
    result = []
    for r in rows:
        row_dict = dict(r)
        row_dict["brief"] = json.loads(row_dict.pop("brief_json"))
        row_dict["actions"] = by_ticket.get(row_dict["ticket_id"], [])
        result.append(row_dict)
    return result


def get_stats(column: str) -> dict:
    """
    Returns {value: count} breakdown for a given column.
    Called by api/history.py for classification_breakdown, severity_breakdown, top_services.
    Only allows specific columns to prevent SQL injection.
    """
    allowed = {"root_cause", "severity", "affected_service"}
    if column not in allowed:
        raise ValueError(f"Column '{column}' not permitted for stats query")
    with get_session() as db:
        rows = db.execute(
            f"""SELECT {column}, COUNT(*) as count
                FROM incidents
                GROUP BY {column}
                ORDER BY count DESC""",
        ).fetchall()
    return {r[0]: r[1] for r in rows if r[0] is not None}


def get_avg_confidence() -> float:
    """
    Returns average confidence_pct across all incidents.
    Called by api/history.py for the enriched stats dashboard payload.
    Returns 0.0 when no incidents exist.
    """
    with get_session() as db:
        row = db.execute(
            "SELECT AVG(confidence_pct) as avg_conf FROM incidents"
        ).fetchone()
    if row and row["avg_conf"] is not None:
        return round(float(row["avg_conf"]), 1)
    return 0.0
