import logging

from langgraph.graph import StateGraph, START, END
from pipeline.state import NexusState
from agents.ticket_agent import run_ticket_agent
from agents.coral_agent import run_coral_agent
from agents.signal_agent import run_signal_agent
from agents.synthesis_agent import run_synthesis_agent
from agents.dispatch_agent import run_dispatch_agent

logger = logging.getLogger(__name__)


def logged(name: str, fn):
    """Wrap a node function with INFO-level logging."""
    def wrapper(state):
        logger.info(f"[NEXUS graph] \u2192 {name}")
        return fn(state)
    return wrapper


def build_graph():
    """
    Builds the NEXUS sequential agent pipeline.

    Node order:
      START -> ticket_agent -> coral_agent -> signal_agent
           -> synthesis_agent -> dispatch_agent -> END

    Rules:
    - Sequential, no parallel branches, no conditional edges.
    - Each node function returns a partial dict of only the keys it writes.
    - Never mutate state directly inside a node.
    - nexus_graph.ainvoke() is called by api/webhook.py (async context).
    - nexus_graph.invoke() is used in tests (sync context).
    """
    graph = StateGraph(NexusState)

    graph.add_node("ticket_agent",    logged("ticket_agent",    run_ticket_agent))
    graph.add_node("coral_agent",     logged("coral_agent",     run_coral_agent))
    graph.add_node("signal_agent",    logged("signal_agent",    run_signal_agent))
    graph.add_node("synthesis_agent", logged("synthesis_agent", run_synthesis_agent))
    graph.add_node("dispatch_agent",  logged("dispatch_agent",  run_dispatch_agent))

    graph.add_edge(START,             "ticket_agent")
    graph.add_edge("ticket_agent",    "coral_agent")
    graph.add_edge("coral_agent",     "signal_agent")
    graph.add_edge("signal_agent",    "synthesis_agent")
    graph.add_edge("synthesis_agent", "dispatch_agent")
    graph.add_edge("dispatch_agent",  END)

    return graph.compile()


# Module-level singleton - imported by api/webhook.py
nexus_graph = build_graph()
