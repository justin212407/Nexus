import logging

from config import settings
from db import ops as db_ops
from integrations.intercom import post_internal_note
from integrations.slack import post_escalation
from pipeline.state import NexusState

logger = logging.getLogger(__name__)


def run_dispatch_agent(state: NexusState) -> dict:
    """
    Routes TechnicalBrief to correct output destinations.

    Routing rules:
    - Always post Intercom internal note
    - Post Slack escalation if confidence is below the threshold or severity is critical
    - Always log dispatch completion in the database

    Returns {"dispatched": True} always, even if delivery fails.
    """
    brief = state.get("brief")
    ticket = state["ticket"]
    threshold = getattr(settings, "CONFIDENCE_THRESHOLD", 70)

    if brief is None:
        logger.error(
            f"dispatch_agent called with brief=None for ticket {ticket.ticket_id}. "
            "synthesis_agent may have failed. Skipping external dispatch."
        )
    else:
        should_escalate = (
            brief.confidence_pct < threshold
            or brief.severity == "critical"
        )

        try:
            post_internal_note(ticket_id=ticket.ticket_id, brief=brief)
            logger.info(
                f"[{ticket.ticket_id}] Intercom note posted "
                f"(confidence={brief.confidence_pct}%, severity={brief.severity})"
            )
        except Exception as exc:
            logger.error(f"Intercom dispatch failed for {ticket.ticket_id}: {exc}")

        if should_escalate:
            try:
                post_escalation(
                    ticket=ticket,
                    brief=brief,
                    channel=settings.SLACK_ESCALATION_CHANNEL,
                )
                logger.info(
                    f"[{ticket.ticket_id}] Slack escalation posted to "
                    f"{settings.SLACK_ESCALATION_CHANNEL} "
                    f"(confidence={brief.confidence_pct}%, severity={brief.severity})"
                )
            except Exception as exc:
                logger.error(f"Slack dispatch failed for {ticket.ticket_id}: {exc}")

    try:
        db_ops.log_dispatch(ticket_id=ticket.ticket_id, dispatched=True)
    except Exception as exc:
        logger.error(f"DB log_dispatch failed for {ticket.ticket_id}: {exc}")

    logger.info(f"[{ticket.ticket_id}] Dispatch complete")
    return {"dispatched": True}
