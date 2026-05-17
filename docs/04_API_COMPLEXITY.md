# NEXUS — API Layer, State Management & Complexity Analysis

> FastAPI webhook handling, SSE streaming, and a full complexity breakdown of the system

---

## FastAPI Application Structure

### Entry Point

```python
# main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.webhook import router as webhook_router
from api.history import router as history_router
from api.stream import router as stream_router
from db.session import init_db

app = FastAPI(title="NEXUS", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"])

app.include_router(webhook_router)
app.include_router(history_router)
app.include_router(stream_router)

@app.on_event("startup")
async def startup():
    init_db()   # CREATE TABLE IF NOT EXISTS

@app.get("/health")
async def health():
    return {"status": "ok", "mode": "demo" if settings.DEMO_MODE else "live"}
```

---

## Webhook Endpoint — The Entry Point

```python
# api/webhook.py

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
import hmac, hashlib
from models.ticket import TicketContext
from pipeline.graph import nexus_graph
from api.stream import broadcast
from config import settings
import datetime

router = APIRouter()

def verify_hmac(body: bytes, signature: str) -> bool:
    """HMAC-SHA256 webhook validation."""
    expected = hmac.new(
        settings.INTERCOM_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)

async def run_pipeline(ticket: TicketContext):
    """Background task: runs the full LangGraph pipeline."""
    await broadcast({"event": "started", "ticket_id": ticket.ticket_id})

    try:
        final_state = nexus_graph.invoke({"ticket": ticket})
        await broadcast({
            "event": "completed",
            "ticket_id": ticket.ticket_id,
            "brief": final_state["brief"].dict()
        })
    except Exception as e:
        await broadcast({
            "event": "error",
            "ticket_id": ticket.ticket_id,
            "message": str(e)
        })

@router.post("/webhook/intercom")
async def intercom_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if not verify_hmac(body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()

    # Parse into TicketContext
    ticket = TicketContext(
        ticket_id=payload["data"]["item"]["id"],
        customer_email=payload["data"]["item"]["user"]["email"],
        message_body=payload["data"]["item"]["conversation_message"]["body"],
        created_at=datetime.datetime.fromisoformat(
            payload["data"]["item"]["created_at"]
        ),
        priority=payload["data"]["item"].get("priority", "normal"),
        tags=[t["name"] for t in payload["data"]["item"].get("tags", {}).get("tags", [])],
    )

    # Return 200 immediately — pipeline runs async
    background_tasks.add_task(run_pipeline, ticket)
    return {"status": "accepted", "ticket_id": ticket.ticket_id}
```

**Why return immediately?** Intercom webhooks have a 10-second response timeout. The Coral query alone can take 3-8 seconds. The Claude synthesis call adds another 2-5 seconds. Running synchronously risks a 504 timeout from Intercom, causing it to retry the webhook (which would process the same ticket twice).

---

## SSE Stream — Real-Time Dashboard Updates

```python
# api/stream.py

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio
import json
from typing import AsyncGenerator

router = APIRouter()

# In-memory event queue (sufficient for hackathon / single-instance demo)
_queue: asyncio.Queue = asyncio.Queue()

async def broadcast(event: dict):
    """Called by pipeline background task to push events to SSE clients."""
    await _queue.put(event)

async def event_generator() -> AsyncGenerator[str, None]:
    """Yields SSE-formatted strings to the client."""
    while True:
        event = await _queue.get()
        yield f"data: {json.dumps(event)}\n\n"

@router.get("/stream")
async def stream():
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable Nginx buffering
        }
    )
```

**SSE over WebSockets** — SSE is unidirectional (server → client) and HTTP/1.1 compatible. For a dashboard that only receives updates (never sends), SSE is simpler and requires zero client-side reconnection logic (`EventSource` auto-reconnects natively).

**Single in-memory queue** — Sufficient for a single-instance demo. In production, this would be a Redis pub/sub channel so multiple server instances can broadcast to the same set of dashboard clients.

---

## History & Analytics Endpoints

```python
# api/history.py

from fastapi import APIRouter
from db.ops import get_recent_briefs, get_stats

router = APIRouter()

@router.get("/history")
def get_history(limit: int = 20):
    return get_recent_briefs(limit=limit)

@router.get("/stats")
def get_stats_endpoint():
    """Returns classification breakdown for the dashboard MetricsBar."""
    return {
        "classification_breakdown": get_stats("root_cause"),
        "severity_breakdown":       get_stats("severity"),
        "top_services":             get_stats("affected_service"),
    }
```

```python
# db/ops.py

from db.session import get_session
import json

def save_brief(ticket, brief):
    with get_session() as db:
        db.execute("""
            INSERT INTO incidents
              (ticket_id, customer_email, root_cause, confidence_pct,
               severity, affected_service, sentry_issue_id, linear_issue_id,
               brief_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            ticket.ticket_id, ticket.customer_email,
            brief.root_cause, brief.confidence_pct,
            brief.severity, brief.affected_service,
            brief.sentry_issue_id if hasattr(brief, "sentry_issue_id") else None,
            brief.linear_issue_id,
            json.dumps(brief.dict())
        ))

def find_similar(customer_email: str, limit: int = 3) -> dict | None:
    with get_session() as db:
        rows = db.execute("""
            SELECT root_cause, confidence_pct, affected_service, created_at
            FROM incidents
            WHERE customer_email = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (customer_email, limit)).fetchall()
    if not rows:
        return None
    return {"matches": [dict(r) for r in rows], "count": len(rows)}

def get_stats(column: str) -> dict:
    with get_session() as db:
        rows = db.execute(f"""
            SELECT {column}, COUNT(*) as count
            FROM incidents
            GROUP BY {column}
            ORDER BY count DESC
        """).fetchall()
    return {r[0]: r[1] for r in rows}
```

---

## Complexity Analysis

### Technical Complexity by Dimension

| Dimension | Rating | Justification |
|---|---|---|
| Data federation | ★★★★★ | 5 external APIs unified in one SQL query via Coral. Real integrations would be 5× the code. |
| Agent orchestration | ★★★☆☆ | Sequential LangGraph pipeline. Complexity is in the state typing and signal transformation, not graph topology. |
| LLM prompt engineering | ★★★★☆ | Deterministic structured JSON from Claude requires careful system prompt + Pydantic validation + retry logic. |
| Async architecture | ★★★☆☆ | Webhook → background task → SSE push. Three concurrent concerns managed with asyncio. |
| Dispatch routing logic | ★★☆☆☆ | Confidence + severity thresholds. Simple but the conditions matter — wrong routing misses escalations. |
| SQLite pattern matching | ★★☆☆☆ | Historical lookup adds context but is a read-through cache, not complex query planning. |
| Frontend (React + SSE) | ★★☆☆☆ | Standard dashboard. The SSE hook (`useSSE.js`) is non-trivial but well-understood. |

---

### What Makes This Non-Trivial

**1. The Coral JOIN is domain-modelling work, not just SQL**

Each JOIN condition encodes a business rule:
- `-2h / +30m` for Sentry: customers don't report bugs instantly
- `-4h` for Slack: engineers see issues in monitoring before customers do
- `-6h` for GitHub: deploy-induced regressions surface slowly
- Fuzzy match on Linear: engineer-written titles don't quote exception class names

Getting these windows wrong means the system either misses real correlations or returns noise.

**2. The Signal transformation layer is the reliability layer**

Raw Coral rows are untyped `dict`. The `SignalAgent` converts them to typed dataclasses with `found: bool`. This is the difference between passing `{"sentry_issue_id": None}` to Claude (which it may hallucinate around) and passing `SentrySignal(found=False, ...)` (which forces explicit handling in the prompt and in dispatch logic).

**3. Structured LLM output requires adversarial prompt design**

Claude must return valid JSON, with the exact keys specified, with the correct types, every time, on the first call. The system prompt alone doesn't guarantee this — the prompt must:
- Enumerate every key with its type
- Specify enumerated values for categorical fields (`root_cause`, `severity`)
- Instruct Claude to return null (not an empty string) for `linear_issue_id` when unknown
- Forbid markdown fences (`\`\`\`json`)

Pydantic validation and a single retry guard against the cases where Claude still produces malformed output.

**4. Async pipeline with a synchronous bottleneck**

Coral runs as a blocking subprocess. FastAPI is async-first. The graph.invoke() call in the background task blocks the event loop thread for up to 30 seconds on a slow Coral query. In production this is solved by running `graph.invoke()` in a `ThreadPoolExecutor`. For the hackathon demo, mock data means the "subprocess" returns in milliseconds.

---

### Lines of Code Estimate

| Module | Estimated LOC | Complexity |
|---|---|---|
| `pipeline/state.py` | ~25 | Low |
| `pipeline/graph.py` | ~30 | Low |
| `agents/ticket_agent.py` | ~40 | Low |
| `agents/coral_agent.py` | ~35 | Medium |
| `agents/signal_agent.py` | ~90 | **High** |
| `agents/synthesis_agent.py` | ~70 | **High** |
| `agents/dispatch_agent.py` | ~50 | Medium |
| `coral/queries.py` | ~60 | **High** (domain logic) |
| `coral/client.py` | ~30 | Low |
| `coral/mock_client.py` | ~25 | Low |
| `models/` (all) | ~80 | Medium |
| `db/ops.py` | ~60 | Medium |
| `api/webhook.py` | ~55 | **High** (HMAC + async) |
| `api/stream.py` | ~35 | Medium |
| `integrations/` (both) | ~80 | Medium |
| `frontend/` (React) | ~300 | Medium |
| **Total** | **~865 LOC** | |

Not a large codebase — but every module is load-bearing. There is no padding. Each file does exactly one thing.

---

### Failure Modes & Mitigations

| Failure | Impact | Mitigation |
|---|---|---|
| Coral returns empty result | `result_set = []` → all Signal objects `found=False` → Claude classifies as `unknown` | Graceful. Brief is posted with low confidence, Slack escalation triggered. |
| Claude returns invalid JSON | `SynthesisAgent` crashes, pipeline dies | `try/except json.loads()` → retry once with correction prompt → raise if still fails |
| Intercom API rate limit | `DispatchAgent` fails to post internal note | Logged to SQLite. Dashboard shows `dispatch_failed`. Retry not implemented in hackathon. |
| Slack API timeout | Escalation not sent | Same as above. Intercom note is already posted. |
| Coral subprocess timeout (30s) | `CoralAgent` raises `RuntimeError` | Caught in `run_pipeline()`, broadcast as `error` event to SSE clients. |
| HMAC validation failure | 401 returned immediately | Webhook body rejected before any processing. |
| SQLite locked (concurrent writes) | `save_brief()` throws | In single-demo context: near-impossible. In production: use WAL mode (`PRAGMA journal_mode=WAL`). |
