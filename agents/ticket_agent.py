from pipeline.state import NexusState
from db import ops as db_ops


def run_ticket_agent(state: NexusState) -> dict:
    """Enriches state with SQLite history. Returns pattern_match."""
    ticket = state["ticket"]
    pattern = db_ops.find_similar(customer_email=ticket.customer_email, limit=3)
    return {"pattern_match": pattern}
