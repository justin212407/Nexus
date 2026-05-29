from langgraph.graph import StateGraph, START, END
from pipeline.state import NexusState
from agents.ticket_agent import run_ticket_agent
from agents.coral_agent import run_coral_agent
from agents.signal_agent import run_signal_agent
from agents.synthesis_agent import run_synthesis_agent
from agents.dispatch_agent import run_dispatch_agent


def build_graph():
    """
    Builds the NEXUS sequential agent pipeline.

    Flow: START -> ticket -> coral -> signal -> synthesis -> dispatch -> END

    Rules:
    - Sequential, no parallel branches, no conditional edges.
    - Each node function returns a partial dict of only the keys it writes.
    - Never mutate state directly inside a node.
    - nexus_graph.ainvoke() is called by api/webhook.py (async context).
    - nexus_graph.invoke() is used in tests (sync context).
    """
    graph = StateGraph(NexusState)

    graph.add_node("ticket_agent",    run_ticket_agent)
    graph.add_node("coral_agent",     run_coral_agent)
    graph.add_node("signal_agent",    run_signal_agent)
    graph.add_node("synthesis_agent", run_synthesis_agent)
    graph.add_node("dispatch_agent",  run_dispatch_agent)

    graph.add_edge(START,             "ticket_agent")
    graph.add_edge("ticket_agent",    "coral_agent")
    graph.add_edge("coral_agent",     "signal_agent")
    graph.add_edge("signal_agent",    "synthesis_agent")
    graph.add_edge("synthesis_agent", "dispatch_agent")
    graph.add_edge("dispatch_agent",  END)

    return graph.compile()


# Module-level singleton - imported by api/webhook.py
nexus_graph = build_graph()
