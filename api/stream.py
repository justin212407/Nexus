import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

# Shared SSE queue
_queue: asyncio.Queue = asyncio.Queue()


async def broadcast(event: dict):
    """Push pipeline events to connected SSE clients."""

    # Ensure consistent event structure
    if "event" not in event:
        raise ValueError("Missing 'event' field")

    if "ticket_id" not in event:
        raise ValueError("Missing 'ticket_id' field")

    await _queue.put(event)


async def event_generator() -> AsyncGenerator[str, None]:
    """Stream events in SSE format."""

    while True:
        event = await _queue.get()
        yield f"data: {json.dumps(event)}\n\n"


@router.get("/stream")
async def stream():
    """Live SSE endpoint for dashboard updates."""

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )