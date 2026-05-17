from config import settings


def format_intercom_note(brief) -> str:
    """TODO: format brief as markdown for Intercom internal note."""
    return f"[NEXUS] root_cause={brief.root_cause} confidence={brief.confidence_pct}%"


def post_internal_note(ticket_id: str, brief) -> None:
    if settings.DEMO_MODE:
        print(f"\n[NEXUS -> Intercom] Ticket {ticket_id}")
        print(format_intercom_note(brief))
        return
    # TODO: implement live Intercom API call
