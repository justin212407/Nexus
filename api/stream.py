import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator

router = APIRouter()

_queue: asyncio.Queue = asyncio.Queue()


async def broadcast(event: dict):
    """Called by pipeline to push events to SSE clients."""
    await _queue.put(event)


async def event_generator() -> AsyncGenerator[str, None]:
    while True:
        event = await _queue.get()
        yield f"data: {json.dumps(event)}\n\n"


@router.get("/stream")
async def stream():
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
