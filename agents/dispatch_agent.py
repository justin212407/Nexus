from config import settings
from db import ops as db_ops
from integrations.intercom import post_internal_note
from integrations.slack import post_escalation
from pipeline.state import NexusState


def run_dispatch_agent(state: NexusState) -> dict:
    """Routes TechnicalBrief to Intercom and conditionally to Slack."""

    ticket = state["ticket"]
    brief = state["brief"]

    if brief is None:
        raise ValueError("brief is required before dispatch")

    post_internal_note(ticket.ticket_id, brief)

    if (
        brief.confidence_pct < settings.CONFIDENCE_THRESHOLD
        or brief.severity == "critical"
    ):
        post_escalation(
            ticket=ticket,
            brief=brief,
            channel=settings.SLACK_ESCALATION_CHANNEL,
        )

    db_ops.log_dispatch(ticket.ticket_id, dispatched=True)

    return {"dispatched": True}
