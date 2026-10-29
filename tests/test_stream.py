import asyncio
import json
import pytest
from api import stream

@pytest.mark.asyncio
async def test_broadcast_reaches_every_subscriber_and_cleans_up():
    first, second = stream.event_generator(), stream.event_generator()
    assert await first.__anext__() == ': connected\n\n'
    assert await second.__anext__() == ': connected\n\n'
    event = {'event': 'completed', 'ticket_id': 'example', 'brief': {'ok': True}}
    await stream.broadcast(event)
    for generator in (first, second):
        message = await asyncio.wait_for(generator.__anext__(), timeout=1)
        assert json.loads(message.removeprefix('data: ').strip()) == event
        await generator.aclose()
    assert not stream._subscribers

@pytest.mark.asyncio
async def test_slow_subscriber_gets_reconciliation_notice():
    generator = stream.event_generator()
    await generator.__anext__()
    for n in range(129):
        await stream.broadcast({'event': 'started', 'ticket_id': str(n)})
    assert 'sync_required' in await generator.__anext__()
    assert '128' in await generator.__anext__()
    await generator.aclose()

@pytest.mark.asyncio
async def test_stream_requires_event_shape():
    for event in ({'ticket_id':'a'}, {'event':'started'}):
        with pytest.raises(ValueError): await stream.broadcast(event)

@pytest.mark.asyncio
async def test_stream_endpoint_headers():
    response = await stream.stream()
    assert response.media_type == 'text/event-stream'
    assert response.headers['x-accel-buffering'] == 'no'
