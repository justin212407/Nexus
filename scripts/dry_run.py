#!/usr/bin/env python
"""Dry run timer — 3 consecutive runs of all scenarios.
Run with: DEMO_MODE=true python scripts/dry_run.py
"""

import os
import sys
import time
from datetime import datetime

os.environ.setdefault("DEMO_MODE", "true")

from pipeline.graph import build_graph
from models.ticket import TicketContext
from db.session import init_db

SCENARIOS = [
    ("Scenario A — Checkout Bug", "ticket_checkout_dry", "urgent", "known_bug", 85),
    ("Scenario B — False Alarm", "ticket_false_dry", "normal", "user_error", 88),
    ("Scenario C — Stripe Outage", "ticket_stripe_dry", "urgent", "external_dependency", 85),
]


def run_once(g, run_number):
    print(f"\n{'='*50}")
    print(f"DRY RUN {run_number}")
    print(f"{'='*50}")
    results = []
    for label, base_id, priority, expected_rc, min_conf in SCENARIOS:
        ticket_id = f"{base_id}_{run_number}"
        ctx = TicketContext(
            ticket_id=ticket_id,
            customer_email="dryrun@example.com",
            message_body="Dry run test message",
            created_at=datetime.now(),
            priority=priority,
            tags=[],
        )
        start = time.time()
        result = g.invoke({"ticket": ctx})
        elapsed = time.time() - start
        brief = result.get("brief")
        rc = getattr(brief, "root_cause", None)
        conf = getattr(brief, "confidence_pct", 0)
        passed = rc == expected_rc and conf >= min_conf and elapsed < 20
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status} {label}: {rc} | {conf}% | {elapsed:.1f}s")
        results.append({
            "label": label,
            "passed": passed,
            "elapsed": elapsed,
            "root_cause": rc,
            "confidence": conf,
        })
    return results


def main():
    init_db()
    g = build_graph()
    all_results = []

    for i in range(1, 4):
        run_results = run_once(g, i)
        all_results.extend(run_results)

    print(f"\n{'='*50}")
    print("DRY RUN SUMMARY")
    print(f"{'='*50}")

    total = len(all_results)
    passed = sum(r["passed"] for r in all_results)
    max_time = max(r["elapsed"] for r in all_results)

    confs_a = [r["confidence"] for r in all_results if "Checkout" in r["label"]]
    confs_b = [r["confidence"] for r in all_results if "False" in r["label"]]
    confs_c = [r["confidence"] for r in all_results if "Stripe" in r["label"]]

    variance_ok = (
        max(confs_a) - min(confs_a) <= 5 and
        max(confs_b) - min(confs_b) <= 5 and
        max(confs_c) - min(confs_c) <= 5
    )

    print(f"  Checks passed: {passed}/{total}")
    print(f"  Max scenario time: {max_time:.1f}s (target: <20s)")
    print(f"  Confidence variance ≤5%: {'YES' if variance_ok else 'NO'}")
    print(f"  Scenario A confidence range: {min(confs_a)}-{max(confs_a)}%")
    print(f"  Scenario B confidence range: {min(confs_b)}-{max(confs_b)}%")
    print(f"  Scenario C confidence range: {min(confs_c)}-{max(confs_c)}%")

    if passed == total and max_time < 20 and variance_ok:
        print("\n=== DRY RUN GATE PASSED — DEMO READY ===")
        sys.exit(0)
    else:
        print("\n=== DRY RUN GATE FAILED ===")
        sys.exit(1)


if __name__ == "__main__":
    main()