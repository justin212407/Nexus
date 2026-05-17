from models.signals import SentrySignal, SlackSignal, DeploySignal, LinearSignal
from pipeline.state import NexusState


def run_signal_agent(state: NexusState) -> dict:
    """Transforms raw result_set rows into 4 typed Signal dataclasses."""
    # TODO: implement full signal extraction — see 02_AGENT_PIPELINE.md
    rows = state["result_set"]
    return {
        "sentry_signal": SentrySignal(found=False, issue_id=None, error_title=None,
                                       culprit=None, first_seen=None, occurrences=0,
                                       affected_users=0, level=None),
        "slack_signal": SlackSignal(found=False, thread_count=0,
                                     earliest_mention=None, messages=[], already_known=False),
        "deploy_signal": DeploySignal(found=False, deploy_sha=None, deploy_time=None,
                                       minutes_before_ticket=None, description=None),
        "linear_signal": LinearSignal(found=False, issue_id=None, issue_title=None,
                                       status=None, assignee=None),
    }
