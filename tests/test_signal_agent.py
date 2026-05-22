import json
from pathlib import Path
from typing import cast

from agents.signal_agent import run_signal_agent
from pipeline.state import NexusState


FIXTURES = Path(__file__).resolve().parents[1] / "mock_data"


def load_fixture(name: str) -> list[dict]:
    return json.loads((FIXTURES / name).read_text())


def make_state(mock_ticket, fixture_name: str) -> NexusState:
    return cast(
        NexusState,
        {
            "ticket": mock_ticket,
            "result_set": load_fixture(fixture_name),
            "sentry_signal": None,
            "slack_signal": None,
            "deploy_signal": None,
            "linear_signal": None,
            "brief": None,
            "dispatched": False,
            "pattern_match": None,
        },
    )


def test_signal_agent_checkout_fixture(mock_ticket):
    result = run_signal_agent(make_state(mock_ticket, "coral_result_a.json"))

    sentry = result["sentry_signal"]
    assert sentry.found is True
    assert sentry.issue_id == "SENT-4721"
    assert sentry.error_title == "NullPointerException"
    assert sentry.culprit == "PaymentService.java:processCheckout"
    assert sentry.occurrences == 1203
    assert sentry.affected_users == 847
    assert sentry.level == "error"

    slack = result["slack_signal"]
    assert slack.found is True
    assert slack.thread_count == 1
    assert slack.already_known is True
    assert slack.earliest_mention == "2025-05-10T14:23:00"
    assert slack.messages == [
        {
            "author": "alice",
            "text": "seeing some payment errors, investigating now",
            "ts": "2025-05-10T14:23:00",
        }
    ]

    deploy = result["deploy_signal"]
    assert deploy.found is True
    assert deploy.deploy_sha == "a3f8c12"
    assert deploy.minutes_before_ticket == 20

    linear = result["linear_signal"]
    assert linear.found is True
    assert linear.issue_id == "LIN-2847"
    assert linear.status == "In Progress"


def test_signal_agent_false_alarm_fixture(mock_ticket):
    result = run_signal_agent(make_state(mock_ticket, "coral_result_b.json"))

    assert result["sentry_signal"].found is False
    assert result["slack_signal"].found is False
    assert result["slack_signal"].thread_count == 0
    assert result["slack_signal"].already_known is False
    assert result["slack_signal"].messages == []
    assert result["deploy_signal"].found is False
    assert result["linear_signal"].found is False


def test_signal_agent_scenario_b_all_null_no_crashes(mock_ticket):
    result = run_signal_agent(make_state(mock_ticket, "coral_result_b.json"))

    assert result["sentry_signal"].found is False
    assert result["slack_signal"].found is False
    assert result["slack_signal"].thread_count == 0
    assert result["slack_signal"].already_known is False
    assert result["slack_signal"].messages == []
    assert result["deploy_signal"].found is False
    assert result["linear_signal"].found is False


def test_signal_agent_scenario_c_matches_current_all_null_fixture(mock_ticket):
    result = run_signal_agent(make_state(mock_ticket, "coral_result_c.json"))

    assert result["sentry_signal"].found is False
    assert result["slack_signal"].found is False
    assert result["slack_signal"].thread_count == 0
    assert result["slack_signal"].already_known is False
    assert result["deploy_signal"].found is False
    assert result["linear_signal"].found is False
