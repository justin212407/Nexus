from pydantic import BaseModel, field_validator
from typing import Literal


class TechnicalBrief(BaseModel):
    # -- Classification --
    # Claude must return exactly one of these five strings.
    # dispatch_agent routes differently based on this value.
    root_cause: Literal[
        "known_bug",
        "service_degradation",
        "user_error",
        "external_dependency",
        "unknown",
    ]

    # 0-100 integer. Below CONFIDENCE_THRESHOLD triggers Slack escalation.
    # Validator coerces string "87" -> int 87 (Claude sometimes returns strings).
    confidence_pct: int

    # Severity gates Slack escalation - "critical" always escalates regardless of confidence.
    severity: Literal["low", "medium", "high", "critical"]

    # -- Incident details --
    affected_service: str
    affected_users: int

    # -- LLM-generated content --
    # Each string in causal_chain must start with a timestamp (e.g. "14:18 - deploy pushed")
    causal_chain: list[str]

    # Technical summary for the engineer - max 3 sentences
    engineer_summary: str

    # Customer-facing response - empathetic, non-technical, max 3 sentences
    draft_customer_response: str

    # What the support engineer should do next
    recommended_action: str

    # -- Optional fields --
    # Linear issue ID e.g. "LIN-2847". Null when no existing bug was found.
    # Never empty string - validator converts "" to None.
    linear_issue_id: str | None = None

    # Additional fields for richer reporting
    affected_endpoint: str | None = None
    resolution_eta: str | None = None

    @field_validator("confidence_pct", mode="before")
    @classmethod
    def coerce_confidence(cls, v):
        """
        Claude sometimes returns confidence_pct as a string "87" instead of int 87.
        This coerces it silently so Pydantic doesn't raise a ValidationError.
        """
        return int(v)

    @field_validator("linear_issue_id", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        """
        Claude sometimes returns "" instead of null for optional string fields.
        Convert empty string to None so the Literal | None type is satisfied.
        """
        return None if v == "" else v

    @field_validator("affected_endpoint", "resolution_eta", mode="before")
    @classmethod
    def optional_empty_to_none(cls, v):
        """Same empty string -> None treatment for other optional fields."""
        return None if v == "" else v

    @field_validator("causal_chain", mode="before")
    @classmethod
    def ensure_list(cls, v):
        """
        Claude occasionally returns a single string instead of a list when
        there is only one causal event. Wrap it so the type is always list[str].
        """
        if isinstance(v, str):
            return [v]
        return v
