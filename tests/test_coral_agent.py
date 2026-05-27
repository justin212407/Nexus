import pytest
from types import SimpleNamespace

from agents import coral_agent
from pipeline.state import NexusState
from models.ticket import TicketContext
from datetime import datetime


@pytest.fixture
def mock_ticket():
    return TicketContext(
        ticket_id="test_ticket_001",
        customer_email="user@example.com",
        message_body="Something is broken",
        created_at=datetime.now(),
        priority="normal",
        tags=["bug"],
    )


def test_coral_agent_returns_result_set_on_success(monkeypatch, mock_ticket):
    """Successful coral_query should return result_set in state."""
    
    def fake_coral_query(*args, **kwargs):
        return [{"sentry_issue_id": "SENT-123", "error_title": "NPE"}]
    
    monkeypatch.setattr(coral_agent, "coral_query", fake_coral_query)
    
    state = {
        "ticket": mock_ticket,
        "result_set": [],
    }
    
    result = coral_agent.run_coral_agent(state)
    
    assert "result_set" in result
    assert result["result_set"] == [{"sentry_issue_id": "SENT-123", "error_title": "NPE"}]


def test_coral_agent_propagates_coral_query_exception(monkeypatch, mock_ticket):
    """When coral_query raises, coral_agent should re-raise as RuntimeError."""
    
    def fake_coral_query(*args, **kwargs):
        raise RuntimeError("Coral source unavailable")
    
    monkeypatch.setattr(coral_agent, "coral_query", fake_coral_query)
    
    state = {
        "ticket": mock_ticket,
        "result_set": [],
    }
    
    with pytest.raises(RuntimeError) as exc_info:
        coral_agent.run_coral_agent(state)
    
    assert "Coral agent failed" in str(exc_info.value)
    assert "test_ticket_001" in str(exc_info.value)


def test_coral_agent_returns_empty_list_when_coral_returns_empty(monkeypatch, mock_ticket):
    """When coral_query returns empty list, should pass through."""
    
    def fake_coral_query(*args, **kwargs):
        return []
    
    monkeypatch.setattr(coral_agent, "coral_query", fake_coral_query)
    
    state = {
        "ticket": mock_ticket,
        "result_set": [],
    }
    
    result = coral_agent.run_coral_agent(state)
    
    assert result["result_set"] == []
