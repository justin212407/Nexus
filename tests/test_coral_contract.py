import json
from pathlib import Path

from coral.queries import MASTER_QUERY
from tests.coral_contract import CANONICAL_CORAL_ALIASES, extract_master_query_aliases


FIXTURES = Path(__file__).resolve().parents[1] / "mock_data"


def test_coral_result_fixtures_match_master_query_alias_contract():
    expected_keys = set(extract_master_query_aliases(MASTER_QUERY))
    assert expected_keys == set(CANONICAL_CORAL_ALIASES)

    for fixture_path in FIXTURES.glob("coral_result*.json"):
        rows = json.loads(fixture_path.read_text())
        assert rows, f"{fixture_path.name} must include at least one row"

        for row in rows:
            assert set(row) == expected_keys, fixture_path.name
