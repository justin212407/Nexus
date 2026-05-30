import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

# PROMPT ITERATION LOG — Day 4
# Scenario A run 1-5: all returned root_cause=known_bug (DEMO_MODE fallback)
# Live mode considerations:
# - causal_chain: instruct Claude to use timestamps from signal data, not generic descriptions
# - draft_customer_response: must be empathetic and non-technical ("our team is investigating"
#   not "NullPointerException in PaymentService")
# - confidence_pct: Claude tends to return 95+ for all known_bug cases; add instruction:
#   "confidence_pct should reflect signal completeness: 90+ only if Sentry+Deploy+Slack all found"
# SYSTEM_PROMPT additions to make:
# - "causal_chain items must reference specific signal data (error IDs, deploy SHAs, timestamps)"
# - "draft_customer_response must be empathetic, under 50 words, avoid technical jargon"
# - "confidence_pct: 85-95 if all signals found, 60-80 if partial, 40-60 if no signals"

from anthropic import Anthropic
from pydantic import ValidationError

from config import settings
from db import ops as db_ops
from models.brief import TechnicalBrief
from pipeline.state import NexusState

logger = logging.getLogger(__name__)
client = Anthropic()


SYSTEM_PROMPT = (
    "You are NEXUS, a customer escalation intelligence system. "
    "Return valid JSON only, with no Markdown fences or explanatory text. "
    "root_cause must be one of: known_bug, service_degradation, user_error, "
    "external_dependency, unknown. confidence_pct must be an integer percentage. "
    "causal_chain must be an array of strings. linear_issue_id must be null "
    "when absent, never an empty string."
)


@dataclass
class HistoricalContext:
    root_cause: str | None = None
    confidence_pct: int | None = None
    affected_service: str | None = None
    matches: list[dict[str, Any]] = field(default_factory=list)
    count: int = 0


def _historical_context_from_pattern(pattern: dict | None) -> HistoricalContext:
    if not pattern:
        return HistoricalContext()

    matches = pattern.get("matches", [])
    if not isinstance(matches, list):
        matches = []

    count = pattern.get("count", len(matches))
    if not isinstance(count, int):
        count = len(matches)

    confidence_pct = pattern.get("confidence_pct")
    if confidence_pct is not None:
        try:
            confidence_pct = int(confidence_pct)
        except (TypeError, ValueError):
            confidence_pct = None

    return HistoricalContext(
        root_cause=pattern.get("root_cause"),
        confidence_pct=confidence_pct,
        affected_service=pattern.get("affected_service"),
        matches=matches,
        count=count,
    )


def _dump_dataclass(value: Any) -> str:
    return json.dumps(value.__dict__, default=str)


def _parse_brief(raw_text: str) -> TechnicalBrief:
    cleaned = raw_text.strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[: -3].strip()

    parsed = json.loads(cleaned)
    return TechnicalBrief(**parsed)


def _load_fallback_brief(sentry, slack, deploy, linear) -> TechnicalBrief | None:
    """Load a fallback brief based on signal patterns.
    
    Returns None if no suitable fallback exists. Handles None signals gracefully.
    """
    # Safely check signal states (handle None signals)
    sentry_found = getattr(sentry, "found", False) if sentry else False
    deploy_found = getattr(deploy, "found", False) if deploy else False
    slack_found = getattr(slack, "found", False) if slack else False
    
    # Resolve paths relative to this module, not CWD
    module_dir = Path(__file__).parent.parent
    
    # Scenario A: Known bug pattern (Sentry + Deploy + Slack)
    if sentry_found and deploy_found and slack_found:
        fallback_path = module_dir / "mock_data" / "brief_fallback_a.json"
        if fallback_path.exists():
            try:
                data = json.loads(fallback_path.read_text())
                return TechnicalBrief(**data)
            except (FileNotFoundError, json.JSONDecodeError, ValidationError) as e:
                logger.warning(f"Failed to load fallback_a: {e.__class__.__name__}: {str(e)[:100]}")
                return None
    
    # Scenario B: User error pattern (all signals null or missing)
    if not sentry_found and not deploy_found and not slack_found:
        fallback_path = module_dir / "mock_data" / "brief_fallback_b.json"
        if fallback_path.exists():
            try:
                data = json.loads(fallback_path.read_text())
                return TechnicalBrief(**data)
            except (FileNotFoundError, json.JSONDecodeError, ValidationError) as e:
                logger.warning(f"Failed to load fallback_b: {e.__class__.__name__}: {str(e)[:100]}")
                return None
    
    return None


def _call_claude(prompt: str):
    if settings.DEMO_MODE:
        raise ValueError("DEMO_MODE: skip Claude, load fallback brief")

    return client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        temperature=0,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )


def run_synthesis_agent(state: NexusState) -> dict:
    """Calls Claude API and validates the TechnicalBrief response."""

    ticket = state["ticket"]
    sentry = state["sentry_signal"]
    slack = state["slack_signal"]
    deploy = state["deploy_signal"]
    linear = state["linear_signal"]
    pattern = state.get("pattern_match")

    user_prompt = (
        f"Ticket: {_dump_dataclass(ticket)}\n"
        f"Sentry: {_dump_dataclass(sentry)}\n"
        f"Slack: {_dump_dataclass(slack)}\n"
        f"Deploy: {_dump_dataclass(deploy)}\n"
        f"Linear: {_dump_dataclass(linear)}\n"
    )

    if pattern:
        historical_context = _historical_context_from_pattern(pattern)
        user_prompt += (
            f"Historical context: {json.dumps(asdict(historical_context), default=str)}\n"
        )

    user_prompt += (
        "Return a TechnicalBrief JSON object with the exact keys: "
        "root_cause, confidence_pct, severity, affected_service, "
        "affected_users, causal_chain, engineer_summary, "
        "draft_customer_response, recommended_action, linear_issue_id. "
        "Return valid JSON only. root_cause must be one of: known_bug, "
        "service_degradation, user_error, external_dependency, unknown. "
        "confidence_pct must be an integer percentage. causal_chain must be "
        "an array of strings. linear_issue_id must be null when absent, "
        "never an empty string."
    )

    last_error: Exception | None = None
    prompt = user_prompt
    max_attempts = 2

    for attempt in range(max_attempts):
        try:
            response = _call_claude(prompt)
            raw_text = response.content[0].text
            brief = _parse_brief(raw_text)
            db_ops.save_brief(ticket, brief)
            logger.info(f"Synthesis succeeded for ticket {ticket.ticket_id}")
            return {"brief": brief}
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = exc
            retry_count = attempt + 1
            logger.warning(
                f"Synthesis attempt {retry_count}/{max_attempts} failed for ticket {ticket.ticket_id}: "
                f"{exc.__class__.__name__}: {str(exc)[:100]}"
            )
            if attempt < max_attempts - 1:
                prompt = (
                    f"{user_prompt}\n\nPrevious response failed validation. "
                    "Return only valid JSON with the exact keys requested."
                )

    # All retries exhausted; try to use fallback brief
    fallback_brief = _load_fallback_brief(sentry, slack, deploy, linear)
    if fallback_brief:
        logger.warning(
            f"Using fallback brief for ticket {ticket.ticket_id} after {max_attempts} retries"
        )
        db_ops.save_brief(ticket, fallback_brief)
        return {"brief": fallback_brief}

    # No fallback available; raise error
    if last_error is not None:
        error_msg = (
            f"synthesis failed after retries: "
            f"{last_error.__class__.__name__}: {str(last_error)[:200]}"
        )
        logger.error(f"Final synthesis error for ticket {ticket.ticket_id}: {error_msg}")
        raise RuntimeError(error_msg)

    raise RuntimeError("synthesis failed (no error details available)")
