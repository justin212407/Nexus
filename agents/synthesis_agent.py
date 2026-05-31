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

import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from anthropic import Anthropic
from pydantic import ValidationError

from config import settings
from db import ops as db_ops
from models.brief import TechnicalBrief
from pipeline.state import NexusState

logger = logging.getLogger(__name__)

# Initialize appropriate client based on which API key is configured
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

if settings.OPENROUTER_API_KEY and OPENAI_AVAILABLE:
    client = OpenAI(
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.io/api/v1"
    )
    USE_OPENROUTER = True
    MODEL = "deepseek/deepseek-chat:free"
else:
    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    USE_OPENROUTER = False
    MODEL = "claude-sonnet-4-20250514"


SYSTEM_PROMPT = """You are NEXUS, a customer escalation intelligence system that analyzes support tickets using engineering signals.

RESPONSE FORMAT:
- Return valid JSON only. No markdown fences, no explanatory text, no preamble.
- Every response must be a single JSON object with exactly these keys:
  root_cause, confidence_pct, severity, affected_service, affected_users,
  causal_chain, engineer_summary, draft_customer_response, recommended_action,
  summary, signals_used, linear_issue_id

FIELD RULES:
- root_cause: MUST be exactly one of: known_bug, service_degradation, user_error, external_dependency, unknown
- confidence_pct: integer 0-100. Use these ranges:
    90-99: all signals found (Sentry + Deploy + Slack), root cause certain
    70-89: most signals found, high confidence
    50-69: partial signals, moderate confidence
    30-49: few signals, low confidence
    0-29: no signals or contradictory signals
- severity: MUST be exactly one of: critical, high, medium, low
- affected_service: string, name of the affected service (e.g. "checkout-api", "auth-service")
- affected_users: integer, estimated number of affected users from signal data
- causal_chain: array of strings. Each item MUST include a timestamp if one is available in the signals.
    Example: ["14:21 — Sentry captured TypeError in payment_processor.charge()", "14:18 — Deploy abc123 pushed 3 minutes before first error"]
    If no timestamp available: ["Sentry error detected in payment flow", "Recent deploy found matching error window"]
- engineer_summary: 1-2 sentences. Technical. For engineers. Reference specific signal data (error IDs, deploy SHAs, service names).
- draft_customer_response: EXACTLY 2-3 sentences. Empathetic. Non-technical. No jargon, no error codes, no stack traces.
    Good: "We're aware of an issue affecting checkout and our team is actively working on a fix. We expect to have this resolved within 30 minutes."
    Bad: "NullPointerException in PaymentService.java:142 has been identified."
- recommended_action: 1 sentence. Specific and actionable.
- summary: 1 sentence. Plain English summary of what happened.
- signals_used: array of strings from: ["sentry", "slack", "deploy", "linear"]. Only include signals that were actually found (found=True).
- linear_issue_id: string if a Linear issue ID was found in signals, null (not empty string "") if not found.

IMPORTANT:
- Never return an empty string "" for linear_issue_id — use null
- Never return a float for confidence_pct — always integer
- Never include markdown, code fences, or explanation outside the JSON object
- If signals are empty or all found=False, root_cause should be user_error or unknown, confidence 40-65
"""


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


def _load_fallback_brief(
    ticket_id: str,
    sentry,
    slack,
    deploy,
    linear,
) -> tuple[TechnicalBrief | None, str | None]:
    """Load a fallback brief based on signal patterns.
    Returns (brief, fallback_label). Handles None signals gracefully.
    """
    sentry_found = getattr(sentry, "found", False) if sentry else False
    deploy_found = getattr(deploy, "found", False) if deploy else False
    slack_found = getattr(slack, "found", False) if slack else False
    module_dir = Path(__file__).parent.parent

    # Scenario A: Known bug (Sentry + Deploy + Slack all found)
    if sentry_found and deploy_found and slack_found:
        fallback_path = module_dir / "mock_data" / "brief_fallback_a.json"
        if fallback_path.exists():
            try:
                data = json.loads(fallback_path.read_text())
                return TechnicalBrief(**data), "a"
            except (FileNotFoundError, json.JSONDecodeError, ValidationError) as exc:
                logger.warning(f"Failed to load fallback a for ticket {ticket_id}: {exc.__class__.__name__}: {str(exc)[:100]}")
                return None, None

    # Scenario C: External dependency (Sentry found but no deploy)
    if sentry_found and not deploy_found:
        fallback_path = module_dir / "mock_data" / "brief_fallback_c.json"
        if fallback_path.exists():
            try:
                data = json.loads(fallback_path.read_text())
                return TechnicalBrief(**data), "c"
            except (FileNotFoundError, json.JSONDecodeError, ValidationError) as exc:
                logger.warning(f"Failed to load fallback c for ticket {ticket_id}: {exc.__class__.__name__}: {str(exc)[:100]}")
                return None, None

    # Scenario B: User error (no signals at all)
    if not sentry_found and not deploy_found and not slack_found:
        fallback_path = module_dir / "mock_data" / "brief_fallback_b.json"
        if fallback_path.exists():
            try:
                data = json.loads(fallback_path.read_text())
                return TechnicalBrief(**data), "b"
            except (FileNotFoundError, json.JSONDecodeError, ValidationError) as exc:
                logger.warning(f"Failed to load fallback b for ticket {ticket_id}: {exc.__class__.__name__}: {str(exc)[:100]}")
                return None, None

    return None, None

    if not sentry_found and not deploy_found and not slack_found:
        fallback_path = module_dir / "mock_data" / "brief_fallback_b.json"
        if fallback_path.exists():
            try:
                data = json.loads(fallback_path.read_text())
                return TechnicalBrief(**data), "b"
            except (FileNotFoundError, json.JSONDecodeError, ValidationError) as exc:
                logger.warning(
                    f"Failed to load fallback b for ticket {ticket_id}: "
                    f"{exc.__class__.__name__}: {str(exc)[:100]}"
                )
                return None, None

    return None, None


def _call_claude(prompt: str):
    if settings.DEMO_MODE:
        raise ValueError("DEMO_MODE: skip Claude, load fallback brief")

    if USE_OPENROUTER:
        # OpenRouter uses OpenAI-compatible API
        response = client.chat.completions.create(
            model=MODEL,
            max_tokens=1000,
            temperature=0,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        # Convert OpenAI response format to Anthropic-compatible format
        class TextBlock:
            def __init__(self, text):
                self.text = text
        
        class MockResponse:
            def __init__(self, content):
                self.content = [TextBlock(content)]
        
        return MockResponse(response.choices[0].message.content)
    else:
        # Use Anthropic API
        return client.messages.create(
            model=MODEL,
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

    required_keys = (
        "root_cause, confidence_pct, severity, affected_service, "
        "affected_users, summary, signals_used, causal_chain, "
        "engineer_summary, draft_customer_response, recommended_action, "
        "linear_issue_id"
    )
    user_prompt += (
        "Return a TechnicalBrief JSON object with the exact keys: "
        f"{required_keys}. "
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
                    f"{user_prompt}\n\n"
                    f"Previous response failed validation with error: "
                    f"{exc.__class__.__name__}: {str(exc)[:200]}\n"
                    "Return ONLY valid JSON. No markdown fences. No explanatory text. "
                    f"Exact keys required: {required_keys}."
                )

    fallback_brief, fallback_label = _load_fallback_brief(
        ticket.ticket_id, sentry, slack, deploy, linear
    )
    if fallback_brief:
        db_ops.save_brief(ticket, fallback_brief)
        logger.warning(
            f"Using fallback brief {fallback_label} for ticket {ticket.ticket_id}"
        )
        return {"brief": fallback_brief}

    if last_error is not None:
        error_msg = (
            f"synthesis failed after retries: "
            f"{last_error.__class__.__name__}: {str(last_error)[:200]}"
        )
        logger.error(f"Final synthesis error for ticket {ticket.ticket_id}: {error_msg}")
        raise RuntimeError(error_msg)

    raise RuntimeError("synthesis failed (no error details available)")
