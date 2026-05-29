import logging

from integrations.intercom import post_internal_note
from integrations.slack import post_escalation
from pipeline.state import NexusState
from config import settings
from db import ops as db_ops

logger = logging.getLogger(__name__)


def run_dispatch_agent(state: NexusState) -> dict:
    """
    Routes TechnicalBrief to correct output destinations.

    Routing rules:
    - Always post Intercom internal note
    - Post Slack escalation if: confidence < CONFIDENCE_THRESHOLD OR severity == 'critical'
    - Inject Linear issue link into both outputs if root_cause == 'known_bug' and linear_issue_id set
      (handled inside intercom.py and slack.py formatters - no extra logic needed here)

    Returns {"dispatched": True} always - even if delivery fails.
    Delivery failures are logged, not raised - the brief is already saved to SQLite.
    """
    brief = state.get("brief")
    ticket = state["ticket"]

    if brief is None:
        logger.error(
            f"dispatch_agent called with brief=None for ticket {ticket.ticket_id}. "
            "synthesis_agent may have failed. Skipping dispatch."
        )
        return {"dispatched": False}

    # Always post to Intercom
    try:
        post_internal_note(ticket_id=ticket.ticket_id, brief=brief)
        logger.info(f"[{ticket.ticket_id}] Intercom note posted")
    except Exception as e:
        logger.error(f"[{ticket.ticket_id}] Intercom note failed: {e}")

    # Slack: low confidence OR critical severity
    should_escalate = (
        brief.confidence_pct < settings.CONFIDENCE_THRESHOLD
        or brief.severity == "critical"
    )

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
        except Exception as e:
            logger.error(f"[{ticket.ticket_id}] Slack escalation failed: {e}")

    db_ops.log_dispatch(ticket_id=ticket.ticket_id, dispatched=True)
    logger.info(f"[{ticket.ticket_id}] Dispatch complete")

    return {"dispatched": True}
