from dataclasses import dataclass
from datetime import datetime


@dataclass
class TicketContext:
    ticket_id: str
    customer_email: str
    message_body: str
    created_at: datetime
    priority: str  # urgent | normal | low
    tags: list[str]