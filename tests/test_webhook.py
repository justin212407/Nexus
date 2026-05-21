import json
import hashlib
import hmac
from pathlib import Path

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
