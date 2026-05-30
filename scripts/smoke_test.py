#!/usr/bin/env python
"""Full smoke test — Scenarios A, B, C. Run with: DEMO_MODE=true python scripts/smoke_test.py"""

import os
import sys
from datetime import datetime

os.environ.setdefault("DEMO_MODE", "true")

from pipeline.graph import build_graph
from models.ticket import TicketContext
from db.session import init_db

def run_scenario(g, label, ticket_id, email, body, priority, expect_root_cause, expect_min_confidence):
    print(f"\n=== {label} ===")
    ctx = TicketContext(
        ticket_id=ticket_id,
        customer_email=email,
        message_body=body,
        created_at=datetime.now(),
        priority=priority,
        tags=[]
    )
    result = g.invoke({"ticket": ctx})
    brief = result.get("brief")
    checks = []

    def check(lbl, condition):
        status = "PASS" if condition else "FAIL"
        print(f"  [{status}] {lbl}")
        checks.append(condition)

    check("brief is not None", brief is not None)
    check(f"root_cause == {expect_root_cause}", getattr(brief, "root_cause", None) == expect_root_cause)
    check(f"confidence_pct >= {expect_min_confidence}", isinstance(getattr(brief, "confidence_pct", 0), int) and brief.confidence_pct >= expect_min_confidence)
    check("confidence_pct is int", isinstance(getattr(brief, "confidence_pct", None), int))
    check("sentry_signal is not None", result.get("sentry_signal") is not None)
    check("slack_signal is not None", result.get("slack_signal") is not None)
    check("deploy_signal is not None", result.get("deploy_signal") is not None)
    check("linear_signal is not None", result.get("linear_signal") is not None)
    check("dispatched == True", result.get("dispatched") == True)

    return checks

def main():
    init_db()
    g = build_graph()
    all_checks = []

    all_checks += run_scenario(g,
        "Scenario A — Checkout Bug (known_bug)",
        "ticket_checkout_smoke", "smoke@example.com",
        "Checkout is completely broken, no payments going through",
        "urgent", "known_bug", 85)

    all_checks += run_scenario(g,
        "Scenario B — False Alarm (user_error)",
        "ticket_false_smoke", "confused@example.com",
        "Cannot log in, think I forgot my password",
        "normal", "user_error", 88)

    all_checks += run_scenario(g,
        "Scenario C — Stripe Outage (external_dependency)",
        "ticket_stripe_smoke", "enterprise@example.com",
        "All payments failing, Stripe returning 503",
        "urgent", "external_dependency", 85)

    print()
    passed = sum(all_checks)
    total = len(all_checks)
    if all(all_checks):
        print(f"=== ALL {total} CHECKS PASS — NEXUS DEMO READY ===")
        sys.exit(0)
    else:
        print(f"=== {total - passed}/{total} CHECKS FAILED ===")
        sys.exit(1)

if __name__ == "__main__":
    main()
