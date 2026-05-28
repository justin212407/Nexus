import logging
import requests

from config import settings

logger = logging.getLogger(__name__)


def log_outbound_request(service: str, method: str, url: str, **kwargs):
    """Log outbound API requests. In DEMO_MODE, skip actual HTTP calls."""
    if settings.DEMO_MODE:
        logger.info(
            f"[DEMO] Would call {service}: {method} {url} | "
            f"params={kwargs.get('params')}, data_keys={list(kwargs.get('json', {}).keys())}"
        )
        return None
    
    logger.info(f"Calling {service}: {method} {url}")
    return requests.request(method, url, **kwargs)


def get_confidence_color(confidence: int) -> str:
    """Return severity color based on confidence."""

    if confidence >= 70:
        return "#2eb886"  # green

    if confidence >= 50:
        return "#f2c744"  # orange

    return "#d50200"  # red


def format_slack_escalation(brief, ticket) -> list[dict]:
    """Build Slack Block Kit escalation payload."""

    confidence_color = get_confidence_color(
        brief.confidence_pct
    )

    linear_block = []

    if getattr(brief, "linear_issue_id", None):
        linear_block = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*Linear Issue:*\n"
                        f"{brief.linear_issue_id}"
                    ),
                },
            }
        ]

    return [
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
                    "text": f"*Severity:*\n{brief.severity}",
                },
                {
                    "type": "mrkdwn",
                    "text": (
                        f"*Confidence:*\n"
                        f"{brief.confidence_pct}%"
                    ),
                },
            ],
        },

        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": (
                        f"Confidence Indicator: "
                        f"`{confidence_color}`"
                    ),
                }
            ],
        },

        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f"*Root Cause:*\n"
                    f"{brief.root_cause}"
                ),
            },
        },

        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f"*Causal Chain:*\n"
                    f"{brief.causal_chain}"
                ),
            },
        },

        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f"*Recommended Action:*\n"
                    f"{brief.recommended_action}"
                ),
            },
        },

        *linear_block,
    ]


def post_escalation(ticket, brief, channel: str) -> None:
    """Send escalation to Slack."""

    blocks = format_slack_escalation(
        brief,
        ticket,
    )

    if settings.DEMO_MODE:
        log_outbound_request(
            "Slack",
            "POST",
            "https://slack.com/api/chat.postMessage",
            json={"channel": channel, "blocks": blocks}
        )
        logger.info(f"[DEMO] Slack escalation to {channel}")
        return

    # Live Slack API call
    log_outbound_request(
        "Slack",
        "POST",
        "https://slack.com/api/chat.postMessage"
    )
    response = requests.post(
        "https://slack.com/api/chat.postMessage",
        headers={
            "Authorization": (
                f"Bearer {settings.SLACK_BOT_TOKEN}"
            ),
            "Content-Type": "application/json",
        },
        json={
            "channel": channel,
            "blocks": blocks,
            "text": (
                f"NEXUS Escalation "
                f"- Ticket {ticket.ticket_id}"
            ),
        },
        timeout=15,
    )

    data = response.json()

    if not data.get("ok"):
        raise RuntimeError(
            f"Slack API Error: {data}"
        )