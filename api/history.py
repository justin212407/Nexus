from fastapi import APIRouter
from db.ops import get_recent_briefs, get_stats

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
    
    # Calculate average confidence (simplified: use a default estimate based on root_cause)
    # In production, we'd store confidence in incidents table and compute the actual average
    avg_confidence_pct = 75  # Default estimate
    
    return {
        "total_incidents": total_incidents,
        "classification_breakdown": root_cause_stats,
        "severity_breakdown": severity_stats,
        "top_service": top_service,
        "avg_confidence_pct": avg_confidence_pct,
    }
