from coral.client import coral_query
from coral.queries import MASTER_QUERY
from pipeline.state import NexusState


def run_coral_agent(state: NexusState) -> dict:
    """Executes Coral SQL. Returns raw result rows."""
    ticket = state["ticket"]
    rows = coral_query(sql=MASTER_QUERY, params={"ticket_id": ticket.ticket_id})
    return {"result_set": rows}
