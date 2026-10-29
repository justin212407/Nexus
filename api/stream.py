"""Broadcast live events independently to each connected workspace."""
import asyncio
import json
from typing import AsyncGenerator
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()
_subscribers: set[asyncio.Queue] = set()

async def broadcast(event: dict):
    if 'event' not in event or 'ticket_id' not in event:
        raise ValueError('Events require event and ticket_id fields')
    for queue in tuple(_subscribers):
        if queue.full():
            while not queue.empty():
                queue.get_nowait()
            queue.put_nowait({'event': 'sync_required', 'ticket_id': event['ticket_id']})
        queue.put_nowait(event)

async def event_generator() -> AsyncGenerator[str, None]:
    queue = asyncio.Queue(maxsize=128)
    _subscribers.add(queue)
    try:
        yield ': connected\n\n'
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15)
                yield f'data: {json.dumps(event)}\n\n'
            except asyncio.TimeoutError:
                yield ': heartbeat\n\n'
    finally:
        _subscribers.discard(queue)

@router.get('/stream')
async def stream():
    return StreamingResponse(event_generator(), media_type='text/event-stream', headers={
        'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no',
    })
