import json
import logging

from slack_sdk import WebClient

from config import settings

logger = logging.getLogger(__name__)


def _severity_emoji(severity: str | None) -> str:
    mapping = {
        "critical": "🔴",
        "high": "🟠",
        "medium": "🟡",
        "low": "🟡",
        "unknown": "🟢",
    }
    return mapping.get((severity or "unknown").lower(), "🟢")


def _root_cause_label(root_cause: str | None) -> str:
    if not root_cause:
        return "Unknown"
    return root_cause.replace("_", " ").title()


def _confidence_pill(confidence_pct: int) -> str:
    if confidence_pct >= 70:
        return f"🟢 {confidence_pct}%"
    if confidence_pct >= 50:
        return f"🟡 {confidence_pct}%"
    return f"🔴 {confidence_pct}%"


def _numbered_chain(chain) -> str:
    steps = list(chain or [])
    return "\n".join(f"{index + 1}. {step}" for index, step in enumerate(steps))


def format_slack_escalation(brief, ticket) -> list[dict]:
    """Build Slack Block Kit escalation payload."""

    confidence_pct = int(getattr(brief, "confidence_pct", 0))
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"NEXUS Escalation — Ticket {ticket.ticket_id}",
            },
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Severity:*\n{_severity_emoji(getattr(brief, 'severity', None))} {brief.severity}",
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Confidence:*\n{_confidence_pill(confidence_pct)}",
                },
            ],
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Root Cause:*\n{_root_cause_label(getattr(brief, 'root_cause', None))}",
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Causal Chain:*\n{_numbered_chain(getattr(brief, 'causal_chain', []))}",
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Engineer Summary:*\n{getattr(brief, 'engineer_summary', '')}",
            },
        },
    ]

    elements = []
    elements.append({"type": "mrkdwn", "text": f"<https://app.intercom.io/conversations/{ticket.ticket_id}|View Ticket>"})
    if getattr(brief, "linear_issue_id", None):
        elements.append({"type": "mrkdwn", "text": f"<https://linear.app/issue/{brief.linear_issue_id}|{brief.linear_issue_id}>"})
    blocks.append({"type": "context", "elements": elements})
    return blocks


def post_escalation(ticket_id: str = None, brief=None, ticket=None, channel: str | None = None, **kwargs) -> None:
    """Send escalation to Slack."""

    ticket = ticket or kwargs.get("ticket")
    brief = brief or kwargs.get("brief")
    channel = channel or kwargs.get("channel") or getattr(settings, "SLACK_CHANNEL", settings.SLACK_ESCALATION_CHANNEL)

    if ticket is None or brief is None:
        raise ValueError("ticket and brief are required")

    resolved_ticket_id = ticket_id or getattr(ticket, "ticket_id", None)
    if not resolved_ticket_id:
        raise ValueError("ticket_id is required")

    blocks = format_slack_escalation(brief, ticket)

    if settings.DEMO_MODE:
        print(f"[NEXUS -> Slack] {channel}")
        print(json.dumps(blocks, indent=2))
        return

    client = WebClient(token=settings.SLACK_BOT_TOKEN)
    try:
        client.chat_postMessage(
            channel=channel,
            blocks=blocks,
            text=f"NEXUS Escalation — {resolved_ticket_id}",
        )
    except Exception:
        logger.exception("Failed to post Slack escalation for ticket %s", resolved_ticket_id)
        raise