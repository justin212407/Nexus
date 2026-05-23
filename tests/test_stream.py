import asyncio

import pytest

from api import stream


def drain_queue():
    while not stream._queue.empty():
        stream._queue.get_nowait()


@pytest.mark.asyncio
async def test_stream_broadcast_and_order():
    drain_queue()

    await stream.broadcast({"event": "started", "ticket_id": "ticket_checkout"})
    await stream.broadcast({"event": "completed", "ticket_id": "ticket_checkout", "brief": {"ok": True}})

    generator = stream.event_generator()
    first = await asyncio.wait_for(generator.__anext__(), timeout=1)
    second = await asyncio.wait_for(generator.__anext__(), timeout=1)

    assert first == 'data: {"event": "started", "ticket_id": "ticket_checkout"}\n\n'
    assert second == 'data: {"event": "completed", "ticket_id": "ticket_checkout", "brief": {"ok": true}}\n\n'


@pytest.mark.asyncio
async def test_stream_requires_event_shape():
    drain_queue()

    with pytest.raises(ValueError):
        await stream.broadcast({"ticket_id": "ticket_checkout"})

    with pytest.raises(ValueError):
        await stream.broadcast({"event": "started"})


@pytest.mark.asyncio
async def test_stream_endpoint_headers():
    response = await stream.stream()

    assert response.media_type == "text/event-stream"
    assert response.headers["x-accel-buffering"] == "no"
