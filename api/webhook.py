import asyncio
import datetime
import hashlib
import hmac
import json
from typing import Set

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from api.stream import broadcast
from config import settings
from models.ticket import TicketContext
from pipeline.graph import nexus_graph

router = APIRouter()

# In-memory dedup store
# Prevents duplicate Intercom retries from launching multiple runs
active_ticket_runs: Set[str] = set()

# Optional lock for concurrent access safety
ticket_lock = asyncio.Lock()


def verify_hmac(body: bytes, signature: str) -> bool:
    expected = hmac.new(
        settings.INTERCOM_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(
        f"sha256={expected}",
        signature,
    )


async def run_pipeline(ticket: TicketContext):
    """
    Executes the Nexus graph pipeline for a ticket.
    Sends SSE lifecycle events:
    - started
    - completed
    - error
    """

    try:
        # START EVENT
        await broadcast({
            "event": "started",
            "ticket_id": ticket.ticket_id,
        })

        # OPTIONAL PROGRESS EVENT
        await broadcast({
            "event": "processing",
            "ticket_id": ticket.ticket_id,
            "stage": "graph_execution",
        })

        # Run graph
        final_state = nexus_graph.invoke({
            "ticket": ticket
        })

        brief = final_state.get("brief")

        # SUCCESS EVENT
        await broadcast({
            "event": "completed",
            "ticket_id": ticket.ticket_id,
            "brief": brief.dict() if brief else None,
        })

    except Exception as e:
        # ERROR EVENT
        await broadcast({
            "event": "error",
            "ticket_id": ticket.ticket_id,
            "message": str(e),
        })

    finally:
        # Cleanup dedup state
        async with ticket_lock:
            active_ticket_runs.discard(ticket.ticket_id)


@router.post("/webhook/intercom")
async def intercom_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Intercom webhook entrypoint.

    Responsibilities:
    - Verify HMAC signature
    - Parse webhook payload
    - Deduplicate retries
    - Schedule async pipeline execution
    """

    body = await request.body()

    signature = request.headers.get(
        "X-Hub-Signature-256",
        "",
    )

    # Demo bypass for local testing
    if signature != "sha256=demo_bypass":
        if not verify_hmac(body, signature):
            raise HTTPException(
                status_code=401,
                detail="Invalid signature",
            )

    try:
        payload = json.loads(body)

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON payload",
        )

    try:
        item = payload["data"]["item"]

        ticket = TicketContext(
            ticket_id=str(item["id"]),

            customer_email=item["user"]["email"],

            message_body=item[
                "conversation_message"
            ]["body"],

            created_at=datetime.datetime.fromisoformat(
                item["created_at"]
            ),

            priority=item.get(
                "priority",
                "normal",
            ),

            tags=[
                tag["name"]
                for tag in item.get(
                    "tags",
                    {},
                ).get("tags", [])
            ],
        )

    except KeyError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required field: {e}",
        )

    # DEDUP CHECK
    async with ticket_lock:

        # Intercom retry detected
        if ticket.ticket_id in active_ticket_runs:

            await broadcast({
                "event": "duplicate_ignored",
                "ticket_id": ticket.ticket_id,
            })

            return {
                "status": "duplicate_ignored",
                "ticket_id": ticket.ticket_id,
            }

        # Mark as active
        active_ticket_runs.add(ticket.ticket_id)

    # QUEUE PIPELINE
    background_tasks.add_task(
        run_pipeline,
        ticket,
    )

    return {
        "status": "accepted",
        "ticket_id": ticket.ticket_id,
    }