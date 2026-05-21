from agents import dispatch_agent
from pipeline.state import NexusState
from typing import cast


def test_dispatch_posts_intercom_only(monkeypatch, mock_ticket, mock_brief):
    calls = {"intercom": [], "slack": [], "db": []}

    monkeypatch.setattr(
        dispatch_agent,
        "post_internal_note",
        lambda ticket_id, brief: calls["intercom"].append((ticket_id, brief)),
    )
    monkeypatch.setattr(
        dispatch_agent,
        "post_escalation",
        lambda **kwargs: calls["slack"].append(kwargs),
    )
    monkeypatch.setattr(
        dispatch_agent.db_ops,
        "log_dispatch",
        lambda ticket_id, dispatched: calls["db"].append((ticket_id, dispatched)),
    )

    state = cast(
        NexusState,
        {
            "ticket": mock_ticket,
            "brief": mock_brief,
            "result_set": [],
            "sentry_signal": None,
            "slack_signal": None,
            "deploy_signal": None,
            "linear_signal": None,
            "dispatched": False,
            "pattern_match": None,
        },
    )

    result = dispatch_agent.run_dispatch_agent(state)

    assert result == {"dispatched": True}
    assert calls["intercom"] == [("ticket_checkout", mock_brief)]
    assert calls["slack"] == []
    assert calls["db"] == [("ticket_checkout", True)]


def test_dispatch_escalates_on_low_confidence(monkeypatch, mock_ticket, mock_brief):
    low_confidence = mock_brief.model_copy(update={"confidence_pct": 69})
    calls = {"intercom": [], "slack": []}

    monkeypatch.setattr(
        dispatch_agent,
        "post_internal_note",
        lambda ticket_id, brief: calls["intercom"].append((ticket_id, brief)),
    )
    monkeypatch.setattr(
        dispatch_agent,
        "post_escalation",
        lambda **kwargs: calls["slack"].append(kwargs),
    )
    monkeypatch.setattr(dispatch_agent.db_ops, "log_dispatch", lambda *args, **kwargs: None)
    monkeypatch.setattr(dispatch_agent.settings, "CONFIDENCE_THRESHOLD", 70)

    state = cast(
        NexusState,
        {
            "ticket": mock_ticket,
            "brief": low_confidence,
            "result_set": [],
            "sentry_signal": None,
            "slack_signal": None,
            "deploy_signal": None,
            "linear_signal": None,
            "dispatched": False,
            "pattern_match": None,
        },
    )

    result = dispatch_agent.run_dispatch_agent(state)

    assert result == {"dispatched": True}
    assert calls["intercom"] == [("ticket_checkout", low_confidence)]
    assert calls["slack"][0]["channel"] == dispatch_agent.settings.SLACK_ESCALATION_CHANNEL


def test_dispatch_escalates_on_critical_severity(monkeypatch, mock_ticket, mock_brief):
    critical = mock_brief.model_copy(update={"severity": "critical"})
    calls = {"intercom": [], "slack": []}

    monkeypatch.setattr(
        dispatch_agent,
        "post_internal_note",
        lambda ticket_id, brief: calls["intercom"].append((ticket_id, brief)),
    )
    monkeypatch.setattr(
        dispatch_agent,
        "post_escalation",
        lambda **kwargs: calls["slack"].append(kwargs),
    )
    monkeypatch.setattr(dispatch_agent.db_ops, "log_dispatch", lambda *args, **kwargs: None)

    state = cast(
        NexusState,
        {
            "ticket": mock_ticket,
            "brief": critical,
            "result_set": [],
            "sentry_signal": None,
            "slack_signal": None,
            "deploy_signal": None,
            "linear_signal": None,
            "dispatched": False,
            "pattern_match": None,
        },
    )

    dispatch_agent.run_dispatch_agent(state)

    assert calls["intercom"] == [("ticket_checkout", critical)]
    assert len(calls["slack"]) == 1
    assert calls["slack"][0]["channel"] == dispatch_agent.settings.SLACK_ESCALATION_CHANNEL
