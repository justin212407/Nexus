import pytest
import datetime
from fastapi.testclient import TestClient
from models.ticket import TicketContext
from models.brief import TechnicalBrief
from models.signals import SentrySignal, SlackSignal, DeploySignal, LinearSignal
from main import app
from config import settings

# Ensure tests run in DEMO_MODE by default
# This prevents tests from trying to call real Coral CLI
pytest_plugins = []


@pytest.fixture(autouse=True)
def ensure_demo_mode(monkeypatch):
    """Ensure DEMO_MODE is enabled for all tests."""
    monkeypatch.setattr(settings, "DEMO_MODE", True)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_ticket():
    return TicketContext(
        ticket_id="ticket_checkout",
        customer_email="sarah.chen@acmecorp.com",
        message_body="Checkout is broken",
        created_at=datetime.datetime(2025, 5, 10, 14, 38, 0),
        priority="urgent",
        tags=["payment", "urgent"],
    )


@pytest.fixture
def mock_brief():
    return TechnicalBrief(
        root_cause="known_bug",
        confidence_pct=94,
        severity="high",
        affected_service="PaymentService",
        affected_users=847,
        summary="Checkout failure caused by a production NullPointerException.",
        signals_used=["sentry", "slack", "deploy"],
        causal_chain=[
            "14:18 - deploy a3f8c12 pushed to production",
            "14:21 - NullPointerException at PaymentService.java:processCheckout",
            "14:23 - engineer flagged in #engineering",
            "14:38 - customer ticket received",
        ],
        engineer_summary="Deploy a3f8c12 introduced a NullPointerException in PaymentService. 847 users affected.",
        draft_customer_response="We've identified the issue causing your checkout to fail and our team is actively working on a fix. We expect this to be resolved within 15 minutes.",
        recommended_action="Rollback deploy a3f8c12 or apply hotfix to PaymentService.java:processCheckout",
        linear_issue_id="LIN-2847",
    )
