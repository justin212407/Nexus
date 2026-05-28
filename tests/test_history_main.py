from api import history
from main import app


def test_history_endpoint_returns_recent_briefs(client, monkeypatch):
    observed = {}
    expected = [{"ticket_id": "ticket_checkout", "root_cause": "known_bug"}]

    def fake_get_recent_briefs(limit):
        observed["limit"] = limit
        return expected

    monkeypatch.setattr(history, "get_recent_briefs", fake_get_recent_briefs)

    response = client.get("/history?limit=7")

    assert response.status_code == 200
    assert response.json() == expected
    assert observed["limit"] == 7


def test_stats_endpoint_returns_required_breakdowns(client, monkeypatch):
    def fake_get_stats(column):
        return {column: 1}

    monkeypatch.setattr(history, "get_stats", fake_get_stats)

    response = client.get("/stats")

    assert response.status_code == 200
    stats = response.json()
    assert stats["classification_breakdown"] == {"root_cause": 1}
    assert stats["severity_breakdown"] == {"severity": 1}
    assert stats["top_service"] == "affected_service"
    assert stats["total_incidents"] == 1
    assert stats["avg_confidence_pct"] == 75


def test_health_reports_ok_and_mode(client, monkeypatch):
    monkeypatch.setattr("main.settings.DEMO_MODE", True)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "mode": "demo",
        "version": "1.0.0",
    }


def test_app_wires_day_3_routes():
    routes = {route.path for route in app.routes}

    assert "/webhook/intercom" in routes
    assert "/stream" in routes
    assert "/history" in routes
    assert "/stats" in routes
    assert "/health" in routes
