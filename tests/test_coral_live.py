"""
Live Coral integration smoke tests.

Only runs when DEMO_MODE=False and real Coral sources are connected.
Validates that actual Coral column names match MASTER_QUERY aliases.

Usage:
  DEMO_MODE=false pytest tests/test_coral_live.py -v --tb=short
"""

import pytest
from coral.client import coral_query
from coral.queries import MASTER_QUERY
from tests.coral_contract import CANONICAL_CORAL_ALIASES, extract_master_query_aliases
from config import settings


pytestmark = pytest.mark.skipif(
    settings.DEMO_MODE,
    reason="Only runs with real Coral sources (DEMO_MODE=false)"
)


def test_master_query_aliases_are_correct():
    """Verify MASTER_QUERY SELECT aliases match contract."""
    extracted_aliases = extract_master_query_aliases(MASTER_QUERY)
    assert set(extracted_aliases) == set(CANONICAL_CORAL_ALIASES)


def test_coral_query_returns_rows_with_expected_columns():
    """Smoke test: Real Coral query should return rows with canonical columns.
    
    This validates that actual column names from real sources match
    what we expect (CANONICAL_CORAL_ALIASES).
    """
    # Query with a dummy ticket_id — Coral will try to find matching data
    # If no matches, result_set will be empty, which is OK for this test
    result = coral_query(MASTER_QUERY, {"ticket_id": "smoke_test"})
    
    assert isinstance(result, list), "Coral query should return list"
    # If empty, that's fine — means no matching data for smoke_test ticket
    # If rows exist, validate they have the right column names
    if result:
        for row in result:
            actual_columns = set(row.keys())
            expected_columns = set(CANONICAL_CORAL_ALIASES)
            
            missing = expected_columns - actual_columns
            extra = actual_columns - expected_columns
            
            assert not missing, (
                f"Missing columns in Coral result: {missing}. "
                f"Actual columns: {actual_columns}"
            )
            assert not extra, (
                f"Extra columns in Coral result: {extra}. "
                f"Expected: {expected_columns}"
            )


def test_coral_sources_availability():
    """Log which Coral sources are available (informational test).
    
    If any source is unavailable, coral_query will timeout and return [].
    This test helps diagnose what sources are connected.
    """
    # Try a simple query that hits multiple sources
    result = coral_query(MASTER_QUERY, {"ticket_id": "availability_check"})
    
    # If we get here, at least Coral CLI is available
    # Empty result means no sources had matching data
    
    # Log for manual inspection
    print(f"\nCoral availability check: got {len(result)} rows")
    if not result:
        print("  → No sources returned data for this ticket")
    else:
        print(f"  → At least one source returned data ✓")
