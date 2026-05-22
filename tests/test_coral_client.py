import json
from types import SimpleNamespace

import coral.client as coral_client
from coral.queries import MASTER_QUERY


def test_coral_query_uses_fixture_in_demo_mode(monkeypatch):
    monkeypatch.setattr(coral_client.settings, "DEMO_MODE", True)

    observed = {}

    def fake_mock_query(params):
        observed["params"] = params
        return [{"ok": True}]

    monkeypatch.setattr("coral.mock_client.mock_query", fake_mock_query)

    result = coral_client.coral_query("SELECT 1", {"ticket_id": "ticket_checkout"})

    assert result == [{"ok": True}]
    assert observed["params"] == {"ticket_id": "ticket_checkout"}


def test_coral_query_executes_subprocess_in_live_mode(monkeypatch):
    monkeypatch.setattr(coral_client.settings, "DEMO_MODE", False)

    observed = {}

    def fake_run(cmd, capture_output, text, timeout):
        observed["cmd"] = cmd
        return SimpleNamespace(returncode=0, stderr="", stdout=json.dumps([{"ok": True}]))

    monkeypatch.setattr(coral_client.subprocess, "run", fake_run)

    result = coral_client.coral_query(
        "SELECT * FROM tickets WHERE id = :ticket_id",
        {"ticket_id": "ticket_checkout"},
    )

    assert result == [{"ok": True}]
    assert observed["cmd"][2] == "SELECT * FROM tickets WHERE id = :ticket_id"
    assert observed["cmd"][-2:] == ["--params", json.dumps({"ticket_id": "ticket_checkout"})]


def test_master_query_uses_canonical_alias_contract():
    expected_aliases = [
        "AS sentry_issue_id",
        "AS error_title",
        "AS error_culprit",
        "AS error_level",
        "AS error_occurrences",
        "AS error_first_seen",
        "AS error_last_seen",
        "AS affected_users",
        "AS slack_thread_ts",
        "AS slack_message",
        "AS slack_author",
        "AS slack_channel",
        "AS deploy_sha",
        "AS deploy_time",
        "AS deploy_description",
        "AS linear_issue_id",
        "AS linear_title",
        "AS linear_status",
        "AS linear_assignee",
    ]

    for alias in expected_aliases:
        assert alias in MASTER_QUERY
