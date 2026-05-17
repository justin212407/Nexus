from typing import TypedDict
from models.ticket import TicketContext
from models.signals import SentrySignal, SlackSignal, DeploySignal, LinearSignal
from models.brief import TechnicalBrief

# FROZEN after Day 2 - never rename a field without explicit team sync.
# TypedDict does not enforce keys at runtime; mismatches surface as KeyErrors.


class NexusState(TypedDict):
    ticket: TicketContext           # set externally by webhook handler before invoke
    result_set: list[dict]          # written by: coral_agent
    sentry_signal: SentrySignal | None   # written by: signal_agent
    slack_signal: SlackSignal | None     # written by: signal_agent
    deploy_signal: DeploySignal | None   # written by: signal_agent
    linear_signal: LinearSignal | None   # written by: signal_agent
    brief: TechnicalBrief | None    # written by: synthesis_agent
    dispatched: bool                # written by: dispatch_agent
    pattern_match: dict | None      # written by: ticket_agent
