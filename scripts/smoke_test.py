#!/usr/bin/env python
"""Scenario A smoke test — run with: DEMO_MODE=true python scripts/smoke_test.py"""

import os
import sys
from datetime import datetime

os.environ.setdefault("DEMO_MODE", "true")

from db.session import init_db
from models.ticket import TicketContext
from pipeline.graph import build_graph


def main():
    init_db()
    g = build_graph()

    ctx = TicketContext(
        ticket_id="smoke_test_a",
        customer_email="smoke@example.com",
        message_body="Checkout is completely broken, no payments going through",
        created_at=datetime.now(),
        priority="urgent",
        tags=["checkout", "payments"],
    )

    print("\n=== NEXUS Smoke Test — Scenario A ===\n")
    result = g.invoke({"ticket": ctx})

    print("\n--- State after graph ---")
    for key, val in result.items():
        print(f"  {key}: {val}")

    print("\n--- Assertions ---")
    checks = []

    brief = result.get("brief")

    def check(label, condition):
        status = "PASS" if condition else "FAIL"
        print(f"  [{status}] {label}")
        checks.append(condition)

    check("brief is not None", brief is not None)
    check("root_cause == known_bug", getattr(brief, "root_cause", None) == "known_bug")
    check(
        "confidence_pct >= 85",
        isinstance(getattr(brief, "confidence_pct", 0), int) and brief.confidence_pct >= 85,
    )
    check("confidence_pct is int", isinstance(getattr(brief, "confidence_pct", None), int))
    check("sentry_signal is not None", result.get("sentry_signal") is not None)
    check("slack_signal is not None", result.get("slack_signal") is not None)
    check("deploy_signal is not None", result.get("deploy_signal") is not None)
    check("linear_signal is not None", result.get("linear_signal") is not None)
    check("dispatched == True", result.get("dispatched") == True)

    print()
    if all(checks):
        print("=== ALL CHECKS PASS — Day 3 Gate PASSED ===")
        sys.exit(0)

    failed = checks.count(False)
    print(f"=== {failed} CHECK(S) FAILED — Day 3 Gate FAILED ===")
    sys.exit(1)


if __name__ == "__main__":
    main()
