import json

from db.session import get_session


def save_brief(ticket, brief) -> None:
    """Persist validated incident brief."""

    with get_session() as db:

        db.execute(
            """
            INSERT OR REPLACE INTO incidents
            (
                ticket_id,
                customer_email,
                root_cause,
                confidence_pct,
                severity,
                affected_service,
                sentry_issue_id,
                linear_issue_id,
                brief_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ticket.ticket_id,
                ticket.customer_email,
                brief.root_cause,
                brief.confidence_pct,
                brief.severity,
                brief.affected_service,

                # Optional signal references
                getattr(brief, "sentry_issue_id", None),
                getattr(brief, "linear_issue_id", None),

                json.dumps(brief.dict()),
            ),
        )

        db.commit()


def ticket_exists(ticket_id: str) -> bool:
    """Used for webhook deduplication."""

    with get_session() as db:

        row = db.execute(
            """
            SELECT ticket_id
            FROM incidents
            WHERE ticket_id = ?
            LIMIT 1
            """,
            (ticket_id,),
        ).fetchone()

    return row is not None


def find_similar(
    customer_email: str,
    limit: int = 3,
) -> dict | None:
    """Fetch recent incidents for same customer."""

    with get_session() as db:

        rows = db.execute(
            """
            SELECT
                root_cause,
                confidence_pct,
                affected_service,
                created_at
            FROM incidents
            WHERE customer_email = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (customer_email, limit),
        ).fetchall()

    if not rows:
        return None

    return {
        "matches": [dict(r) for r in rows],
        "count": len(rows),
    }


def get_stats(column: str) -> dict:
    """Aggregate incident statistics."""

    with get_session() as db:

        rows = db.execute(
            f"""
            SELECT
                {column},
                COUNT(*) as count
            FROM incidents
            GROUP BY {column}
            ORDER BY count DESC
            """
        ).fetchall()

    return {
        r[0]: r[1]
        for r in rows
    }


def get_recent_briefs(limit: int = 20) -> list[dict]:
    """Return latest synthesized briefs."""

    with get_session() as db:

        rows = db.execute(
            """
            SELECT brief_json
            FROM incidents
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [
        json.loads(r["brief_json"])
        for r in rows
    ]


def log_dispatch(
    ticket_id: str,
    dispatched: bool,
) -> None:
    """Mark incident as dispatched/resolved."""

    with get_session() as db:

        if dispatched:
            db.execute(
                """
                UPDATE incidents
                SET
                    resolved_at = CURRENT_TIMESTAMP
                WHERE ticket_id = ?
                """,
                (ticket_id,),
            )

        db.commit()
