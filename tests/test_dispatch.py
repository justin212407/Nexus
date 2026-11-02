import pytest
from agents import dispatch_agent

@pytest.mark.parametrize('severity,confidence', [('high',94),('critical',94),('low',32)])
def test_analysis_never_dispatches_automatically(monkeypatch, mock_ticket, mock_brief, severity, confidence):
    def forbidden(*args, **kwargs):
        raise AssertionError('Analysis must wait for explicit operator approval')
    monkeypatch.setattr('integrations.intercom.post_internal_note', forbidden)
    monkeypatch.setattr('integrations.slack.post_escalation', forbidden)
    monkeypatch.setattr(dispatch_agent.logger, 'info', lambda *args: None)
    brief=mock_brief.model_copy(update={'severity':severity,'confidence_pct':confidence})
    assert dispatch_agent.run_dispatch_agent({'ticket':mock_ticket,'brief':brief}) == {'dispatched':False}
