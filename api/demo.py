"""Deterministic, explicitly requested sample data; no external calls."""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings
from db.ops import save_brief, ticket_exists
from models.brief import TechnicalBrief
from models.ticket import TicketContext

router = APIRouter(prefix="/demo", tags=["demo"])
FIXTURES = Path(__file__).resolve().parents[1] / "mock_data"


class DemoSelection(BaseModel):
    scenario: Literal["all", "checkout", "login", "payment"] = "all"


@router.post("/samples")
def load_samples(selection: DemoSelection):
    if not settings.DEMO_MODE:
        raise HTTPException(409, "Sample tickets are available only in demo mode.")
    samples = json.loads((FIXTURES / "workspace_samples.json").read_text())
    added, ids = [], []
    for sample in samples:
        if selection.scenario != "all" and sample["scenario"] != selection.scenario:
            continue
        ticket_id = sample["ticket_id"]
        ids.append(ticket_id)
        if ticket_exists(ticket_id):
            continue
        brief = TechnicalBrief(**json.loads((FIXTURES / sample["brief_file"]).read_text()))
        ticket = TicketContext(
            ticket_id=ticket_id, customer_email=sample["customer_email"],
            message_body=sample["message_body"],
            created_at=datetime.now(timezone.utc) - timedelta(minutes=sample["minutes_ago"]),
            priority="urgent" if brief.severity in ("critical", "high") else "normal", tags=["demo"],
        )
        save_brief(ticket, brief)
        added.append(ticket_id)
    return {"mode": "demo", "added": added, "ticket_ids": ids}
