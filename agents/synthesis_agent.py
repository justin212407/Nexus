import json
from typing import Any

from anthropic import Anthropic
from pydantic import ValidationError

from db import ops as db_ops
from models.brief import TechnicalBrief
from pipeline.state import NexusState


client = Anthropic()


SYSTEM_PROMPT = (
    "You are NEXUS, a customer escalation intelligence system. "
    "Return valid JSON only."
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


def _call_claude(prompt: str):
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
        user_prompt += f"Historical context: {json.dumps(pattern)}\n"

    user_prompt += (
        "Return a TechnicalBrief JSON object with the exact keys: "
        "root_cause, confidence_pct, severity, affected_service, "
        "affected_users, causal_chain, engineer_summary, "
        "draft_customer_response, recommended_action, linear_issue_id."
    )

    last_error: Exception | None = None
    prompt = user_prompt

    for attempt in range(2):
        try:
            response = _call_claude(prompt)
            raw_text = response.content[0].text
            brief = _parse_brief(raw_text)
            db_ops.save_brief(ticket, brief)
            return {"brief": brief}
        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = exc
            prompt = (
                f"{user_prompt}\n\nPrevious response failed validation. "
                "Return only valid JSON with the exact keys requested."
            )

    if last_error is not None:
        raise last_error

    raise RuntimeError("synthesis failed")
