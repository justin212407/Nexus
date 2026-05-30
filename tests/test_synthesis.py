import json
import pytest
from types import SimpleNamespace
from typing import cast

import agents.synthesis_agent as synthesis_agent
from pipeline.state import NexusState
from config import settings


def make_response(payload: str):
    return SimpleNamespace(content=[SimpleNamespace(text=payload)])


@pytest.fixture
def disable_demo_mode(monkeypatch):
    """Override ensure_demo_mode fixture for synthesis tests.
    
    Synthesis tests need DEMO_MODE=False to test Claude API mocking.
    """
    monkeypatch.setattr(settings, "DEMO_MODE", False)


def sample_state(mock_ticket):
    return cast(NexusState, {
        "ticket": mock_ticket,
        "sentry_signal": SimpleNamespace(
            found=True,
            issue_id="SENT-4721",
            error_title="NullPointerException",
            culprit="PaymentService.java:processCheckout",
            first_seen="2025-05-10T14:21:00",
            occurrences=1203,
            affected_users=847,
            level="error",
        ),
        "slack_signal": SimpleNamespace(
            found=True,
            thread_count=1,
            earliest_mention="2025-05-10T14:23:00",
            messages=[{"author": "alice", "text": "investigating", "ts": "2025-05-10T14:23:00"}],
            already_known=True,
        ),
        "deploy_signal": SimpleNamespace(
            found=True,
            deploy_sha="a3f8c12",
            deploy_time="2025-05-10T14:18:00",
            minutes_before_ticket=20,
            description="refactor: payment gateway timeout handling",
        ),
        "linear_signal": SimpleNamespace(
            found=True,
            issue_id="LIN-2847",
            issue_title="Payment checkout failing with NPE on timeout",
            status="In Progress",
            assignee="alice",
        ),
        "pattern_match": {"root_cause": "known_bug", "count": 2},
        "brief": None,
        "dispatched": False,
    })


def test_synthesis_builds_prompt_and_validates(monkeypatch, mock_ticket, disable_demo_mode):
    prompts = []
    saved = {}

    valid_payload = {
        "root_cause": "known_bug",
        "confidence_pct": "94",
        "severity": "high",
        "affected_service": "PaymentService",
        "affected_users": 847,
        "summary": "Deploy introduced a payment bug.",
        "signals_used": ["sentry", "slack", "deploy"],
        "causal_chain": ["2025-05-10T14:18:00 deploy", "2025-05-10T14:21:00 error"],
        "engineer_summary": "Deploy introduced a payment bug.",
        "draft_customer_response": "We found the issue and are working on it.",
        "recommended_action": "Rollback the deploy.",
        "linear_issue_id": "LIN-2847",
    }

    def fake_create(**kwargs):
        prompts.append(kwargs["messages"][0]["content"])
        return make_response(json.dumps(valid_payload))

    monkeypatch.setattr(synthesis_agent.client.messages, "create", fake_create)
    monkeypatch.setattr(
        synthesis_agent.db_ops,
        "save_brief",
        lambda ticket, brief: saved.update({"ticket": ticket, "brief": brief}),
    )

    result = synthesis_agent.run_synthesis_agent(sample_state(mock_ticket))

    assert len(prompts) == 1
    assert "ticket_checkout" in prompts[0]
    assert "PaymentService.java:processCheckout" in prompts[0]
    assert "known_bug" in prompts[0]

    brief = result["brief"]
    assert brief.confidence_pct == 94
    assert brief.linear_issue_id == "LIN-2847"
    assert saved["ticket"].ticket_id == "ticket_checkout"
    assert saved["brief"].root_cause == "known_bug"


def test_synthesis_retries_after_json_failure(monkeypatch, mock_ticket, disable_demo_mode):
    calls = []
    saved = {}

    valid_payload = {
        "root_cause": "known_bug",
        "confidence_pct": 91,
        "severity": "high",
        "affected_service": "PaymentService",
        "affected_users": 847,
        "causal_chain": ["2025-05-10T14:18:00 deploy"],
        "engineer_summary": "Deploy introduced a payment bug.",
        "draft_customer_response": "We found the issue.",
        "recommended_action": "Rollback the deploy.",
        "linear_issue_id": "LIN-2847",
    }

    responses = [
        make_response("not json"),
        make_response(json.dumps(valid_payload)),
    ]

    def fake_create(**kwargs):
        calls.append(kwargs["messages"][0]["content"])
        return responses.pop(0)

    monkeypatch.setattr(synthesis_agent.client.messages, "create", fake_create)
    monkeypatch.setattr(
        synthesis_agent.db_ops,
        "save_brief",
        lambda ticket, brief: saved.update({"ticket": ticket, "brief": brief}),
    )

    result = synthesis_agent.run_synthesis_agent(sample_state(mock_ticket))

    assert len(calls) == 2
    assert "Previous response failed validation" in calls[1]
    assert result["brief"].confidence_pct == 91
    assert saved["ticket"].ticket_id == "ticket_checkout"
