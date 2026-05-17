from config import settings


def format_slack_escalation(brief, ticket) -> list[dict]:
    """TODO: return Slack Block Kit blocks."""
    return [{"type": "section", "text": {"type": "mrkdwn",
             "text": f"*NEXUS Alert* — {ticket.ticket_id}\n{brief.root_cause} ({brief.confidence_pct}%)"}}]


def post_escalation(ticket, brief, channel: str) -> None:
    if settings.DEMO_MODE:
        print(f"\n[NEXUS -> Slack] Channel {channel}")
        print(format_slack_escalation(brief, ticket))
        return
    # TODO: implement live Slack Bolt SDK call
