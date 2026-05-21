from dataclasses import dataclass
from datetime import datetime
from typing import Literal


@dataclass
class TicketContext:
    ticket_id: str
    customer_email: str
    message_body: str
    created_at: datetime
    priority: Literal["urgent", "normal", "low"]
    tags: list[str]
