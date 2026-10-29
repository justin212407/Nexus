import pytest
from config import settings
from db import ops
from db.session import init_db, get_session

@pytest.fixture(autouse=True)
def isolated_database(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, 'DATABASE_URL', f'sqlite:///{tmp_path}/review.db')
    init_db()

@pytest.fixture
def ticket_id(mock_ticket, mock_brief):
    ops.save_brief(mock_ticket, mock_brief)
    return mock_ticket.ticket_id

def payload(request_id='approved-request-1', content='The exact edited reply', destination='sarah.chen@acmecorp.com'):
    return dict(request_id=request_id,content=content,destination=destination)

def test_exact_reply_is_recorded_once_and_survives_reload(client, ticket_id):
    body=payload()
    first=client.post(f'/tickets/{ticket_id}/reply',json=body)
    second=client.post(f'/tickets/{ticket_id}/reply',json=body)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert first.json()['status']=='simulated'
    history=client.get('/history').json()[0]
    assert history['environment']=='demo'
    assert history['message_body']=='Checkout is broken'
    assert len(history['actions'])==1
    assert history['actions'][0]['content']==body['content']
    assert history['review_resolved_at'] is None

def test_reused_approval_with_different_content_is_rejected(client, ticket_id):
    assert client.post(f'/tickets/{ticket_id}/reply',json=payload()).status_code==200
    assert client.post(f'/tickets/{ticket_id}/reply',json=payload(content='Changed content')).status_code==409

def test_resolution_is_independent_of_reply_and_escalation(client, ticket_id):
    client.post(f'/tickets/{ticket_id}/reply',json=payload())
    assert client.post(f'/tickets/{ticket_id}/escalate',json=payload('approved-request-2','Internal message',settings.SLACK_ESCALATION_CHANNEL)).status_code==200
    assert client.get('/history').json()[0]['review_resolved_at'] is None
    assert client.post(f'/tickets/{ticket_id}/resolve',json=payload('approved-request-3','','NEXUS workspace')).status_code==200
    row=client.get('/history').json()[0]
    assert row['review_resolved_at'] is not None
    assert len(row['actions'])==3
    with get_session() as db:
        legacy=db.execute('SELECT dispatched,resolved_at FROM incidents WHERE ticket_id=?',(ticket_id,)).fetchone()
        assert legacy['dispatched']==0 and legacy['resolved_at'] is None

def test_live_mode_rejects_demo_actions_and_seeding(client, ticket_id, monkeypatch):
    monkeypatch.setattr(settings,'DEMO_MODE',False)
    assert client.post(f'/tickets/{ticket_id}/reply',json=payload()).status_code==409
    assert client.post('/demo/samples',json={'scenario':'all'}).status_code==409

def test_unknown_provenance_cannot_be_treated_as_demo(client, ticket_id):
    with get_session() as db: db.execute('DELETE FROM ticket_reviews WHERE ticket_id=?',(ticket_id,))
    assert client.post(f'/tickets/{ticket_id}/reply',json=payload()).status_code==409
    assert client.get('/history').json()[0]['environment'] is None

def test_wrong_destination_and_empty_reply_are_rejected(client,ticket_id):
    assert client.post(f'/tickets/{ticket_id}/reply',json=payload(destination='wrong@example.com')).status_code==409
    assert client.post(f'/tickets/{ticket_id}/reply',json=payload(content='   ')).status_code==422

def test_reprocessing_a_legacy_record_does_not_guess_its_environment(client, ticket_id, mock_ticket, mock_brief):
    with get_session() as db:
        db.execute('DELETE FROM ticket_reviews WHERE ticket_id=?', (ticket_id,))
    ops.save_brief(mock_ticket, mock_brief)
    assert client.get('/history').json()[0]['environment'] is None

def test_seed_is_idempotent_and_preserves_review(client):
    one=client.post('/demo/samples',json={'scenario':'all'})
    two=client.post('/demo/samples',json={'scenario':'all'})
    assert len(one.json()['added'])==6
    assert two.json()['added']==[]
    assert len(client.get('/history').json())==6
    assert all(t['environment']=='demo' for t in client.get('/history').json())
