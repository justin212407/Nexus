import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)


def _severity_badge(severity: str | None) -> str:
    mapping = {
        "critical": "🔴 critical",
        "high": "🟠 high",
        "medium": "🟡 medium",
        "low": "🟡 low",
        "unknown": "🟢 unknown",
    }
    return mapping.get((severity or "unknown").lower(), f"🟢 {severity or 'unknown'}")


def _root_cause_label(root_cause: str | None) -> str:
    if not root_cause:
        return "Unknown"
    return root_cause.replace("_", " ").title()


def _numbered_chain(chain) -> str:
    steps = list(chain or [])
    return "\n".join(f"{index + 1}. {step}" for index, step in enumerate(steps))


def format_intercom_note(brief) -> str:
    """Format synthesized brief into Intercom markdown note."""

    confidence_pct = int(getattr(brief, "confidence_pct", 0))
    causal_chain = _numbered_chain(getattr(brief, "causal_chain", []))
    note = (
        "## NEXUS Incident Analysis\n\n"
        f"**Severity:** {_severity_badge(getattr(brief, 'severity', None))}  |  "
        f"**Confidence:** {confidence_pct}% confidence  |  "
        f"**Root Cause:** {_root_cause_label(getattr(brief, 'root_cause', None))}\n\n"
        "---\n\n"
        "### Causal Chain\n"
        f"{causal_chain}\n\n"
        "### Engineer Summary\n"
        f"{getattr(brief, 'engineer_summary', '')}\n\n"
        "### Recommended Action\n"
        f"{getattr(brief, 'recommended_action', '')}"
    )

    linear_issue_id = getattr(brief, "linear_issue_id", None)
    if linear_issue_id:
        note += (
            "\n\n### Linear Issue\n"
            f"[View {linear_issue_id}](https://linear.app/issue/{linear_issue_id})"
        )

    return note


def post_internal_note(ticket_id: str, brief) -> None:
    """Post internal note to Intercom."""

    note = format_intercom_note(brief)

    if settings.DEMO_MODE:
        print(f"[NEXUS -> Intercom] Ticket {ticket_id}")
        print(note)
        return

    url = f"https://api.intercom.io/conversations/{ticket_id}/reply"
    headers = {
        "Authorization": f"Bearer {getattr(settings, 'INTERCOM_TOKEN', '') or settings.INTERCOM_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    body = {
        "message_type": "note",
        "type": "admin",
        "admin_id": settings.INTERCOM_ADMIN_ID,
        "body": note,
    }

    try:
        response = httpx.post(url, headers=headers, json=body, timeout=15)
        response.raise_for_status()
    except Exception:
        logger.exception("Failed to post Intercom internal note for ticket %s", ticket_id)
        raise