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
    description="Customer Escalation Intelligence Agent",
)

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
    init_db()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "mode": "demo" if settings.DEMO_MODE else "live",
        "version": "1.0.0",
    }
