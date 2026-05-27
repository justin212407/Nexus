import asyncio
import datetime
import hashlib
import hmac
import json
import logging
from typing import Set

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from api.stream import broadcast
from config import settings
from db import ops as db_ops
from models.ticket import TicketContext
from pipeline.graph import nexus_graph

logger = logging.getLogger(__name__)
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


def check_coral_sources_health() -> dict:
    """Check availability of Coral sources.
    
    Returns:
        {
            "available_sources": ["sentry", "slack", ...],
            "count": int,
            "healthy": bool  # True if >= 3 sources available
        }
    
    In DEMO_MODE, returns mocked health (all sources available).
    In live mode, test each source with a minimal query.
    """
    # In demo mode, assume all sources are available (don't call real Coral)
    if settings.DEMO_MODE:
        return {
            "available_sources": ["sentry", "slack", "github", "linear"],
            "count": 4,
            "healthy": True,
        }
    
    # In live mode, test each source with a minimal query
    # Only import coral_query if we're actually in live mode
    try:
        from coral.client import coral_query
    except ImportError:
        logger.warning("Could not import coral_query; assuming sources unavailable")
        return {
            "available_sources": [],
            "count": 0,
            "healthy": False,
        }
    
    sources_to_check = {
        "sentry": "SELECT 1 FROM sentry.issues LIMIT 1",
        "slack": "SELECT 1 FROM slack.messages LIMIT 1",
        "github": "SELECT 1 FROM github.deployments LIMIT 1",
        "linear": "SELECT 1 FROM linear.issues LIMIT 1",
    }
    
    available = []
    
    for source_name, query in sources_to_check.items():
        try:
            result = coral_query(query, {})
            # If query returns anything (even empty), source is available
            available.append(source_name)
            logger.info(f"Source {source_name} available ✓")
        except Exception as e:
            logger.warning(f"Source {source_name} unavailable: {str(e)}")
    
    count = len(available)
    healthy = count >= 3
    
    logger.info(
        f"Coral sources health: {count}/4 available, "
        f"{'healthy' if healthy else 'degraded'}"
    )
    
    return {
        "available_sources": available,
        "count": count,
        "healthy": healthy,
    }


async def run_pipeline(ticket: TicketContext):
    """
    Executes the Nexus graph pipeline for a ticket.
    Sends SSE lifecycle events:
    - started
    - sources_checked
    - completed
    - error
    """

    try:
        # START EVENT
        await broadcast({
            "event": "started",
            "ticket_id": ticket.ticket_id,
        })

        # CHECK SOURCES HEALTH
        health = check_coral_sources_health()
        await broadcast({
            "event": "sources_checked",
            "ticket_id": ticket.ticket_id,
            "available_sources": health["available_sources"],
            "source_count": health["count"],
            "healthy": health["healthy"],
        })

        # Run graph
        final_state = await nexus_graph.ainvoke({
            "ticket": ticket
        })

        await broadcast({
            "event": "coral_done",
            "ticket_id": ticket.ticket_id,
            "row_count": len(final_state.get("result_set", [])),
        })

        signals_found = []
        if getattr(final_state.get("sentry_signal"), "found", False):
            signals_found.append("sentry")
        if getattr(final_state.get("slack_signal"), "found", False):
            signals_found.append("slack")
        if getattr(final_state.get("deploy_signal"), "found", False):
            signals_found.append("deploy")
        if getattr(final_state.get("linear_signal"), "found", False):
            signals_found.append("linear")

        await broadcast({
            "event": "signal_done",
            "ticket_id": ticket.ticket_id,
            "signals_found": signals_found,
        })

        brief = final_state.get("brief")

        await broadcast({
            "event": "synthesis_done",
            "ticket_id": ticket.ticket_id,
            "confidence_pct": brief.confidence_pct if brief else 0,
            "root_cause": brief.root_cause if brief else "unknown",
        })

        # SUCCESS EVENT
        await broadcast({
            "event": "completed",
            "ticket_id": ticket.ticket_id,
            "brief": brief.model_dump() if brief else None,
        })

    except Exception as e:
        # ERROR EVENT
        logger.error(f"Pipeline failed for ticket {ticket.ticket_id}: {str(e)}", exc_info=True)
        await broadcast({
            "event": "error",
            "ticket_id": ticket.ticket_id,
            "message": str(e),
        })

    finally:
        # Cleanup dedup state
        async with ticket_lock:
            active_ticket_runs.discard(ticket.ticket_id)
        logger.info(f"Pipeline cleanup completed for ticket {ticket.ticket_id}")


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
                for tag in (item.get("tags") or {}).get("tags", [])
            ],
        )

    except KeyError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required field: {e}",
        )

    # DEDUP CHECK
    async with ticket_lock:

        if db_ops.ticket_exists(ticket.ticket_id):
            return {
                "status": "already_processed",
                "ticket_id": ticket.ticket_id,
            }

        # Intercom retry detected
        if ticket.ticket_id in active_ticket_runs:
            return {
                "status": "duplicate_ignored",
                "ticket_id": ticket.ticket_id,
            }

        # Mark as active
        active_ticket_runs.add(ticket.ticket_id)

    # CHECK SOURCE HEALTH (early feedback to caller)
    health = check_coral_sources_health()

    # QUEUE PIPELINE
    background_tasks.add_task(
        run_pipeline,
        ticket,
    )

    # Return response with health status
    response = {
        "status": "degraded" if not health["healthy"] else "accepted",
        "ticket_id": ticket.ticket_id,
        "available_sources": health["available_sources"],
        "source_count": health["count"],
    }
    
    if not health["healthy"]:
        response["message"] = (
            f"Investigation may be incomplete: only {health['count']}/4 sources available"
        )
    
    return response
