"""Finish analysis without sending: review actions belong to the operator."""

import logging

from pipeline.state import NexusState

logger = logging.getLogger(__name__)


def run_dispatch_agent(state: NexusState) -> dict:
    """Preserve the sequential graph while holding every brief for human review."""
    logger.info("[%s] Analysis ready for review; no outbound dispatch", state["ticket"].ticket_id)
    return {"dispatched": False}
