import logging
import requests

from config import settings

logger = logging.getLogger(__name__)


def log_outbound_request(service: str, method: str, url: str, **kwargs):
    """Log-only wrapper for API calls. Does not execute HTTP requests.
    
    This helper is used to audit all outbound API calls in DEMO_MODE.
    In live mode, callers use requests directly with full headers/auth.
    """
    if settings.DEMO_MODE:
        logger.info(
            f"[DEMO] Would call {service}: {method} {url} | "
            f"params={kwargs.get('params')}, data_keys={list(kwargs.get('json', {}).keys())}"
        )
    else:
        logger.info(f"Calling {service}: {method} {url}")


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

    if settings.DEMO_MODE:
        log_outbound_request(
            "Intercom",
            "POST",
            f"https://api.intercom.io/conversations/{ticket_id}/reply",
            json={"message_type": "note", "body": note}
        )
        print(f"\n[NEXUS -> Intercom] Ticket {ticket_id}")
        print(note)
        return

    # Live Intercom API call
    log_outbound_request("Intercom", "POST", f"https://api.intercom.io/conversations/{ticket_id}/reply")
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