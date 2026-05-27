import logging

from coral.client import coral_query
from coral.queries import MASTER_QUERY
from pipeline.state import NexusState

logger = logging.getLogger(__name__)


def run_coral_agent(state: NexusState) -> dict:
    """Executes Coral SQL. Returns raw result rows.
    
    If Coral query fails, raises RuntimeError to be caught by run_pipeline(),
    which broadcasts the error event.
    """
    ticket = state["ticket"]
    
    try:
        rows = coral_query(sql=MASTER_QUERY, params={"ticket_id": ticket.ticket_id})
        logger.info(f"Coral query returned {len(rows)} row(s) for ticket {ticket.ticket_id}")
        return {"result_set": rows}
    except Exception as e:
        error_msg = f"Coral agent failed for ticket {ticket.ticket_id}: {str(e)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)
