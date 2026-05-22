import re


CANONICAL_CORAL_ALIASES = [
    "sentry_issue_id",
    "error_title",
    "error_culprit",
    "error_level",
    "error_occurrences",
    "error_first_seen",
    "error_last_seen",
    "affected_users",
    "slack_thread_ts",
    "slack_message",
    "slack_author",
    "slack_channel",
    "deploy_sha",
    "deploy_time",
    "deploy_description",
    "linear_issue_id",
    "linear_title",
    "linear_status",
    "linear_assignee",
]


def extract_master_query_aliases(master_query: str) -> list[str]:
    return re.findall(r"\bAS\s+([A-Za-z_][A-Za-z0-9_]*)\b", master_query)
