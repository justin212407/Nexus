import datetime
import hmac
import hashlib
import json
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from models.ticket import TicketContext
from pipeline.graph import nexus_graph
from api.stream import broadcast
from config import settings

router = APIRouter()


def verify_hmac(body: bytes, signature: str) -> bool:
    expected = hmac.new(
        settings.INTERCOM_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


async def run_pipeline(ticket: TicketContext):
    await broadcast({"event": "started", "ticket_id": ticket.ticket_id})
    try:
        final_state = nexus_graph.invoke({"ticket": ticket})
        brief = final_state.get("brief")
        await broadcast({
            "event": "completed",
            "ticket_id": ticket.ticket_id,
            "brief": brief.dict() if brief else None,
        })
    except Exception as e:
        await broadcast({
            "event": "error",
            "ticket_id": ticket.ticket_id,
            "message": str(e),
        })


@router.post("/webhook/intercom")
async def intercom_webhook(request: Request, background_tasks: BackgroundTasks):
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    # Allow demo bypass for testing
    if signature != "sha256=demo_bypass":
        if not verify_hmac(body, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

    payload = json.loads(body)

    ticket = TicketContext(
        ticket_id=payload["data"]["item"]["id"],
        customer_email=payload["data"]["item"]["user"]["email"],
        message_body=payload["data"]["item"]["conversation_message"]["body"],
        created_at=datetime.datetime.fromisoformat(
            payload["data"]["item"]["created_at"]
        ),
        priority=payload["data"]["item"].get("priority", "normal"),
        tags=[
            t["name"]
            for t in payload["data"]["item"].get("tags", {}).get("tags", [])
        ],
    )

    background_tasks.add_task(run_pipeline, ticket)
    return {"status": "accepted", "ticket_id": ticket.ticket_id}
