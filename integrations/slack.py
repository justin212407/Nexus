import requests

from config import settings


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

    # Demo/local mode
    if settings.DEMO_MODE:
        print(f"\n[NEXUS -> Slack] Channel {channel}")
        print(blocks)
        return

    # Live Slack API call
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