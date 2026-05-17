from fastapi import APIRouter
from db.ops import get_recent_briefs, get_stats

router = APIRouter()


@router.get("/history")
def get_history(limit: int = 20):
    return get_recent_briefs(limit=limit)


@router.get("/stats")
def get_stats_endpoint():
    return {
        "classification_breakdown": get_stats("root_cause"),
        "severity_breakdown": get_stats("severity"),
        "top_services": get_stats("affected_service"),
    }
