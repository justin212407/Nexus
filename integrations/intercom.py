import requests

from config import settings


def format_intercom_note(brief) -> str:
    """Format synthesized brief into Intercom markdown note."""

    linear_reference = ""

    if getattr(brief, "linear_issue_id", None):
        linear_reference = (
            f"\n\n**Linear Issue:** "
            f"{brief.linear_issue_id}"
        )

    return f"""
# NEXUS Incident Analysis

**Severity:** {brief.severity}
**Confidence:** {brief.confidence_pct}%

## Root Cause
{brief.root_cause}

## Causal Chain
{brief.causal_chain}

## Engineer Summary
{brief.engineer_summary}

## Recommended Action
{brief.recommended_action}
{linear_reference}
""".strip()


def post_internal_note(ticket_id: str, brief) -> None:
    """Post internal note to Intercom."""

    note = format_intercom_note(brief)

    # Demo/local mode
    if settings.DEMO_MODE:
        print(f"\n[NEXUS -> Intercom] Ticket {ticket_id}")
        print(note)
        return

    # Live Intercom API call
    response = requests.post(
        f"https://api.intercom.io/conversations/{ticket_id}/reply",
        headers={
            "Authorization": f"Bearer {settings.INTERCOM_ACCESS_TOKEN}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        json={
            "message_type": "note",
            "type": "admin",
            "admin_id": settings.INTERCOM_ADMIN_ID,
            "body": note,
        },
        timeout=15,
    )

    response.raise_for_status()