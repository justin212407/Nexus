import json
from db.session import get_session


def save_brief(ticket, brief) -> None:
    with get_session() as db:
        db.execute(
            """INSERT OR IGNORE INTO incidents
               (ticket_id, customer_email, root_cause, confidence_pct,
                severity, affected_service, sentry_issue_id, linear_issue_id, brief_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                ticket.ticket_id,
                ticket.customer_email,
                brief.root_cause,
                brief.confidence_pct,
                brief.severity,
                brief.affected_service,
                None,  # sentry_issue_id — add if needed
                brief.linear_issue_id,
                json.dumps(brief.dict()),
            ),
        )


def find_similar(customer_email: str, limit: int = 3) -> dict | None:
    with get_session() as db:
        rows = db.execute(
            """SELECT root_cause, confidence_pct, affected_service, created_at
               FROM incidents WHERE customer_email = ?
               ORDER BY created_at DESC LIMIT ?""",
            (customer_email, limit),
        ).fetchall()
    if not rows:
        return None
    return {"matches": [dict(r) for r in rows], "count": len(rows)}


def get_stats(column: str) -> dict:
    with get_session() as db:
        rows = db.execute(
            f"SELECT {column}, COUNT(*) as count FROM incidents GROUP BY {column} ORDER BY count DESC"
        ).fetchall()
    return {r[0]: r[1] for r in rows}


def get_recent_briefs(limit: int = 20) -> list[dict]:
    with get_session() as db:
        rows = db.execute(
            "SELECT brief_json FROM incidents ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [json.loads(r["brief_json"]) for r in rows]


def log_dispatch(ticket_id: str, dispatched: bool) -> None:
    with get_session() as db:
        db.execute(
            "UPDATE incidents SET resolved_at = CURRENT_TIMESTAMP WHERE ticket_id = ?",
            (ticket_id,),
        )
