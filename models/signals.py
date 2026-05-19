from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class SentrySignal:
    found: bool
    issue_id: str | None
    error_title: str | None
    culprit: str | None
    first_seen: str | None
    occurrences: int
    affected_users: int
    level: str | None


@dataclass
class SlackSignal:
    found: bool
    thread_count: int
    earliest_mention: str | None
    messages: list[dict] = field(default_factory=list)
    already_known: bool = False


@dataclass
class DeploySignal:
    found: bool
    deploy_sha: str | None
    deploy_time: datetime | None
    minutes_before_ticket: int | None
    description: str | None


@dataclass
class LinearSignal:
    found: bool
    issue_id: str | None
    issue_title: str | None
    status: str | None
    assignee: str | None