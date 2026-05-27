import json
import subprocess
from unittest.mock import Mock, patch

import pytest

from coral import client as coral_client
from config import settings


class TestCoralQueryTimeout:
    """Test coral_query timeout handling and retry logic."""

    def test_coral_query_timeout_returns_empty_list_after_retries(self, monkeypatch):
        """When subprocess times out after retries, should raise RuntimeError."""
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        
        call_count = [0]
        
        def fake_run(*args, **kwargs):
            call_count[0] += 1
            raise subprocess.TimeoutExpired("coral", 30)
        
        monkeypatch.setattr(subprocess, "run", fake_run)
        monkeypatch.setattr("coral.client.time.sleep", Mock())  # Skip actual sleep
        
        with pytest.raises(RuntimeError) as exc_info:
            coral_client.coral_query("SELECT 1", {"ticket_id": "test"})
        
        assert "timeout" in str(exc_info.value).lower()
        assert call_count[0] == 2  # Should retry exactly once after initial failure

    def test_coral_query_retries_once_on_first_timeout(self, monkeypatch):
        """First attempt times out, second succeeds."""
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        
        call_count = [0]
        
        def fake_run(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                raise subprocess.TimeoutExpired("coral", 30)
            # Second call succeeds
            result = Mock()
            result.returncode = 0
            result.stdout = '["success"]'
            result.stderr = ""
            return result
        
        monkeypatch.setattr(subprocess, "run", fake_run)
        monkeypatch.setattr("coral.client.time.sleep", Mock())  # Skip actual sleep
        
        result = coral_client.coral_query("SELECT 1", {"ticket_id": "test"})
        
        assert result == ["success"]
        assert call_count[0] == 2  # Tried twice

    def test_coral_query_subprocess_error_raises(self, monkeypatch):
        """When subprocess returns error code, raises RuntimeError."""
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        
        def fake_run(*args, **kwargs):
            result = Mock()
            result.returncode = 1
            result.stderr = "Source connection failed"
            return result
        
        monkeypatch.setattr(subprocess, "run", fake_run)
        
        with pytest.raises(RuntimeError) as exc_info:
            coral_client.coral_query("SELECT 1", {"ticket_id": "test"})
        
        assert "Coral query failed" in str(exc_info.value)
        assert "Source connection failed" in str(exc_info.value)

    def test_coral_query_json_parse_error_raises(self, monkeypatch):
        """When stdout is not valid JSON, raises RuntimeError."""
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        
        def fake_run(*args, **kwargs):
            result = Mock()
            result.returncode = 0
            result.stdout = "not json"
            result.stderr = ""
            return result
        
        monkeypatch.setattr(subprocess, "run", fake_run)
        
        with pytest.raises(RuntimeError) as exc_info:
            coral_client.coral_query("SELECT 1", {"ticket_id": "test"})
        
        assert "JSON parse error" in str(exc_info.value)

    def test_coral_query_with_params_builds_correct_cmd(self, monkeypatch):
        """Verify params are passed to subprocess command."""
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        
        captured_cmd = []
        
        def fake_run(cmd, *args, **kwargs):
            captured_cmd.append(cmd)
            result = Mock()
            result.returncode = 0
            result.stdout = '[]'
            result.stderr = ""
            return result
        
        monkeypatch.setattr(subprocess, "run", fake_run)
        
        coral_client.coral_query("SELECT * WHERE id = :ticket_id", {"ticket_id": "abc123"})
        
        assert captured_cmd[0] == ["coral", "sql", "SELECT * WHERE id = :ticket_id", "--format", "json", "--params", '{"ticket_id": "abc123"}']

    def test_coral_query_demo_mode_returns_fixture(self, monkeypatch):
        """In DEMO_MODE, should bypass subprocess and use mock_query."""
        monkeypatch.setattr(settings, "DEMO_MODE", True)
        
        fake_run = Mock(side_effect=AssertionError("subprocess should not be called"))
        monkeypatch.setattr(subprocess, "run", fake_run)
        
        # Should not raise, uses mock_query instead
        result = coral_client.coral_query("SELECT 1", {"ticket_id": "ticket_checkout"})
        
        assert isinstance(result, list)
        # coral_result_a.json fixture should be loaded
        if result:
            assert "sentry_issue_id" in result[0]

    def test_coral_query_empty_result_set_is_valid(self, monkeypatch):
        """Empty result set is a valid return (no rows match), not an error."""
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        
        def fake_run(*args, **kwargs):
            result = Mock()
            result.returncode = 0
            result.stdout = '[]'
            result.stderr = ""
            return result
        
        monkeypatch.setattr(subprocess, "run", fake_run)
        
        result = coral_client.coral_query("SELECT 1", {"ticket_id": "test"})
        
        assert result == []  # Empty list is fine, not an error
