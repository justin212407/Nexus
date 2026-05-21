import json
from pathlib import Path


FIXTURE_MAP = {
    "ticket_checkout": "mock_data/coral_result_a.json",
    "ticket_login": "mock_data/coral_result_b.json",
    "ticket_payment": "mock_data/coral_result_c.json",
}


def mock_query(params: dict) -> list[dict]:
    """Return fixture data in DEMO_MODE."""

    ticket_id = params.get(
        "ticket_id",
        "ticket_checkout",
    )

    key = (
        ticket_id
        if ticket_id in FIXTURE_MAP
        else "ticket_checkout"
    )

    fixture_path = Path(FIXTURE_MAP[key])

    return json.loads(
        fixture_path.read_text()
    )