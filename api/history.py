from fastapi import APIRouter
from db.ops import get_recent_briefs, get_stats, get_avg_confidence

router = APIRouter()


@router.get("/history")
def get_history(limit: int = 20):
    return get_recent_briefs(limit=limit)


@router.get("/stats")
def get_stats_endpoint():
    """Return metrics for dashboard display."""
    root_cause_stats = get_stats("root_cause")
    service_stats = get_stats("affected_service")
    severity_stats = get_stats("severity")

    # Calculate totals
    total_incidents = sum(root_cause_stats.values())

    # Get top affected service
    top_service = max(service_stats.items(), key=lambda x: x[1])[0] if service_stats else "unknown"

    return {
        "total_incidents": total_incidents,
        "classification_breakdown": root_cause_stats,
        "severity_breakdown": severity_stats,
        "top_service": top_service,
        "avg_confidence_pct": get_avg_confidence(),
    }
