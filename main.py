from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.webhook import router as webhook_router
from api.history import router as history_router
from api.stream import router as stream_router
from db.session import init_db
from config import settings

app = FastAPI(
    title="NEXUS",
    version="1.0.0",
    description="Customer Escalation Intelligence Agent — Built on Coral Protocol",
)

# Allow all origins for local dev and demo day.
# In production this would be locked to specific domains.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook_router)
app.include_router(history_router)
app.include_router(stream_router)


@app.on_event("startup")
async def startup():
    """Initialise SQLite on every startup. CREATE TABLE IF NOT EXISTS is idempotent."""
    init_db()


@app.get("/health")
async def health():
    """
    Health check endpoint. Returns mode so the dashboard can show
    DEMO / LIVE indicator without reading env vars on the client.
    """
    return {
        "status": "ok",
        "mode": "demo" if settings.DEMO_MODE else "live",
        "version": "1.0.0",
    }
