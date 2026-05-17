from pydantic import BaseModel, field_validator
from typing import Literal


class TechnicalBrief(BaseModel):
    root_cause: Literal[
        "known_bug",
        "service_degradation",
        "user_error",
        "external_dependency",
        "unknown",
    ]
    confidence_pct: int
    severity: Literal["low", "medium", "high", "critical"]
    affected_service: str
    affected_users: int
    causal_chain: list[str]
    engineer_summary: str
    draft_customer_response: str
    recommended_action: str
    linear_issue_id: str | None

    @field_validator("confidence_pct", mode="before")
    @classmethod
    def coerce_confidence(cls, v):
        return int(v)

    @field_validator("linear_issue_id", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        return None if v == "" else v
