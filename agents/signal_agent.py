from datetime import datetime

from models.signals import DeploySignal, LinearSignal, SlackSignal, SentrySignal
from pipeline.state import NexusState


def run_signal_agent(state: NexusState) -> dict:
    """Transforms raw Coral rows into typed signal dataclasses."""

    rows = state["result_set"]
    ticket = state["ticket"]

    sentry_rows = [row for row in rows if row.get("sentry_issue_id")]
    if sentry_rows:
        row = sentry_rows[0]
        sentry = SentrySignal(
            found=True,
            issue_id=row["sentry_issue_id"],
            error_title=row["error_title"],
            culprit=row["error_culprit"],
            first_seen=row["error_first_seen"],
            occurrences=row.get("error_occurrences", 0),
            affected_users=row.get("affected_users", 0),
            level=row.get("error_level"),
        )
    else:
        sentry = SentrySignal(
            found=False,
            issue_id=None,
            error_title=None,
            culprit=None,
            first_seen=None,
            occurrences=0,
            affected_users=0,
            level=None,
        )

    slack_rows = [row for row in rows if row.get("slack_message")]
    slack = SlackSignal(
        found=bool(slack_rows),
        thread_count=len(slack_rows),
        earliest_mention=slack_rows[0]["slack_thread_ts"] if slack_rows else None,
        messages=[
            {
                "author": row["slack_author"],
                "text": row["slack_message"],
                "ts": row["slack_thread_ts"],
            }
            for row in slack_rows
        ],
        already_known=bool(slack_rows),
    )

    deploy_rows = [row for row in rows if row.get("deploy_sha")]
    if deploy_rows:
        row = deploy_rows[0]
        deploy_time = datetime.fromisoformat(row["deploy_time"])
        minutes_before_ticket = int(
            (ticket.created_at - deploy_time).total_seconds() / 60
        )
        deploy = DeploySignal(
            found=True,
            deploy_sha=row["deploy_sha"],
            deploy_time=row["deploy_time"],
            minutes_before_ticket=minutes_before_ticket,
            description=row.get("deploy_description"),
        )
    else:
        deploy = DeploySignal(
            found=False,
            deploy_sha=None,
            deploy_time=None,
            minutes_before_ticket=None,
            description=None,
        )

    linear_rows = [row for row in rows if row.get("linear_issue_id")]
    if linear_rows:
        row = linear_rows[0]
        linear = LinearSignal(
            found=True,
            issue_id=row["linear_issue_id"],
            issue_title=row["linear_title"],
            status=row["linear_status"],
            assignee=row.get("linear_assignee"),
        )
    else:
        linear = LinearSignal(
            found=False,
            issue_id=None,
            issue_title=None,
            status=None,
            assignee=None,
        )

    return {
        "sentry_signal": sentry,
        "slack_signal": slack,
        "deploy_signal": deploy,
        "linear_signal": linear,
    }