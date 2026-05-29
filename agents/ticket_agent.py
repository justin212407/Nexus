from pipeline.state import NexusState
from db import ops as db_ops


def run_ticket_agent(state: NexusState) -> dict:
    """
    Enriches NexusState with historical pattern context from SQLite.
    Does NOT parse the ticket - the webhook handler already did that.
    Returns only pattern_match - never rewrites the ticket key.
    """
    ticket = state["ticket"]
    pattern = db_ops.find_similar(
        customer_email=ticket.customer_email,
        limit=3,
    )
    return {"pattern_match": pattern}
