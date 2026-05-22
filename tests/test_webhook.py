import json
import hashlib
import hmac
from pathlib import Path
from types import SimpleNamespace

import pytest

from api import webhook


def make_signature(body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def test_webhook_rejects_bad_signature(client):
    body = json.dumps({"data": {"item": {"id": "x"}}})
    response = client.post(
        "/webhook/intercom",
        data=body,
        headers={"X-Hub-Signature-256": "sha256=bad"},
    )

    assert response.status_code == 401


def test_webhook_accepts_demo_bypass_and_schedules_task(client, monkeypatch):
    captured = {}

    def fake_add_task(self, func, *args, **kwargs):
        captured["func"] = func
        captured["args"] = args
        captured["kwargs"] = kwargs

    monkeypatch.setattr(webhook.BackgroundTasks, "add_task", fake_add_task)
    monkeypatch.setattr(webhook.db_ops, "ticket_exists", lambda ticket_id: False)

    body = (Path(__file__).resolve().parents[1] / "mock_data" / "ticket_checkout.json").read_text()
    response = client.post(
        "/webhook/intercom",
        data=body,
        headers={"X-Hub-Signature-256": "sha256=demo_bypass"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    assert captured["func"] is webhook.run_pipeline
    assert captured["args"][0].ticket_id == "ticket_checkout"


def test_webhook_accepts_valid_hmac(client, monkeypatch):
    captured = {}

    def fake_add_task(self, func, *args, **kwargs):
        captured["func"] = func
        captured["args"] = args
        captured["kwargs"] = kwargs

    monkeypatch.setattr(webhook.BackgroundTasks, "add_task", fake_add_task)
    monkeypatch.setattr(webhook.db_ops, "ticket_exists", lambda ticket_id: False)

    body = (Path(__file__).resolve().parents[1] / "mock_data" / "ticket_login.json").read_text().encode()
    signature = make_signature(body, webhook.settings.INTERCOM_WEBHOOK_SECRET)

    response = client.post(
        "/webhook/intercom",
        data=body,
        headers={"X-Hub-Signature-256": signature},
    )

    assert response.status_code == 200
    assert captured["func"] is webhook.run_pipeline
    assert captured["args"][0].ticket_id == "ticket_login"


def test_webhook_skips_already_processed_ticket(client, monkeypatch):
    captured = {}

    def fake_add_task(self, func, *args, **kwargs):
        captured["scheduled"] = True

    monkeypatch.setattr(webhook.BackgroundTasks, "add_task", fake_add_task)
    monkeypatch.setattr(webhook.db_ops, "ticket_exists", lambda ticket_id: True)

    body = (Path(__file__).resolve().parents[1] / "mock_data" / "ticket_payment.json").read_text()
    response = client.post(
        "/webhook/intercom",
        data=body,
        headers={"X-Hub-Signature-256": "sha256=demo_bypass"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "already_processed"
    assert "scheduled" not in captured


@pytest.mark.asyncio
async def test_run_pipeline_emits_canonical_lifecycle_events(monkeypatch, mock_ticket, mock_brief):
    events = []

    async def fake_ainvoke(payload):
        return {
            "result_set": [{"id": "row1"}, {"id": "row2"}],
            "sentry_signal": SimpleNamespace(found=True),
            "slack_signal": SimpleNamespace(found=False),
            "deploy_signal": SimpleNamespace(found=True),
            "linear_signal": SimpleNamespace(found=False),
            "brief": mock_brief,
        }

    async def fake_broadcast(event):
        events.append(event)

    monkeypatch.setattr(webhook.nexus_graph, "ainvoke", fake_ainvoke)
    monkeypatch.setattr(webhook, "broadcast", fake_broadcast)

    webhook.active_ticket_runs.add(mock_ticket.ticket_id)
    await webhook.run_pipeline(mock_ticket)

    assert [event["event"] for event in events] == [
        "started",
        "coral_done",
        "signal_done",
        "synthesis_done",
        "completed",
    ]
    assert events[1]["row_count"] == 2
    assert events[2]["signals_found"] == ["sentry", "deploy"]
    assert events[3]["confidence_pct"] == mock_brief.confidence_pct
    assert events[3]["root_cause"] == mock_brief.root_cause
