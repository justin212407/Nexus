"""Explicit, idempotent demo review. Live delivery is unavailable in iteration 1."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import settings
from db.session import get_session

router = APIRouter(prefix="/tickets", tags=["review"])


class ApprovedAction(BaseModel):
    request_id: str = Field(min_length=8, max_length=100)
    content: str = Field(default="", max_length=20000)
    destination: str = Field(min_length=1, max_length=500)


@router.get("/config")
def review_config():
    return {
        "mode": "demo" if settings.DEMO_MODE else "live",
        "simulated_actions": settings.DEMO_MODE,
        "live_delivery": False,
        "slack_channel": settings.SLACK_ESCALATION_CHANNEL,
    }


@router.post("/{ticket_id}/{action}")
def review_action(ticket_id: str, action: Literal["reply", "escalate", "resolve"], payload: ApprovedAction):
    if not settings.DEMO_MODE:
        raise HTTPException(409, "Live delivery is not available in this iteration.")
    with get_session() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute(
            """SELECT i.customer_email, r.environment, r.resolved_at
               FROM incidents i LEFT JOIN ticket_reviews r ON i.ticket_id = r.ticket_id
               WHERE i.ticket_id = ?""", (ticket_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(404, "Ticket not found.")
        if row["environment"] != "demo":
            raise HTTPException(409, "Only demo tickets can be used for simulated actions.")
        destination = {
            "reply": row["customer_email"], "escalate": settings.SLACK_ESCALATION_CHANNEL,
            "resolve": "NEXUS workspace",
        }[action]
        if payload.destination != destination:
            raise HTTPException(409, "The destination changed. Review the action again.")
        if action != "resolve" and not payload.content.strip():
            raise HTTPException(422, "A message is required.")
        if action == "resolve" and payload.content:
            raise HTTPException(422, "Resolution has no message body.")
        previous = db.execute("SELECT * FROM review_actions WHERE request_id = ?", (payload.request_id,)).fetchone()
        if previous:
            if any(previous[key] != value for key, value in {
                "ticket_id": ticket_id, "action": action, "content": payload.content,
                "destination": destination,
            }.items()):
                raise HTTPException(409, "This approval was already used for a different action.")
            return {"status": "simulated", "action": dict(previous)}
        if row["resolved_at"]:
            raise HTTPException(409, "This ticket is already resolved in NEXUS.")
        db.execute(
            "INSERT INTO review_actions (request_id, ticket_id, action, content, destination) VALUES (?, ?, ?, ?, ?)",
            (payload.request_id, ticket_id, action, payload.content, destination),
        )
        if action == "resolve":
            db.execute("UPDATE ticket_reviews SET resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE ticket_id = ?", (ticket_id,))
        recorded = dict(db.execute("SELECT * FROM review_actions WHERE request_id = ?", (payload.request_id,)).fetchone())
    return {"status": "simulated", "action": recorded}
