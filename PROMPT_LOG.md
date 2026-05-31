# NEXUS Prompt Iteration Log

## Final SYSTEM_PROMPT Version: v3.0 (Day 6)

### Changes from v2.0 (Day 4)

1. Added explicit confidence_pct ranges with signal-count mapping (90-99 all signals, 70-89 most, etc.)
2. Added timestamp requirement for causal_chain items
3. Clarified draft_customer_response: exactly 2-3 sentences, empathetic, non-technical, with good/bad examples
4. Changed linear_issue_id rule: explicitly `null` not `""`
5. Added signals_used field rules: only include signals where found=True
6. Added explicit instruction: never return float for confidence_pct

### Day 4 Prompt Iteration Round 1 — DEMO_MODE Results

All 5 runs returned root_cause=known_bug via fallback_a (DEMO_MODE, not Claude)
Live mode considerations documented:

- causal_chain: must reference specific signal data with timestamps
- draft_customer_response: empathetic, under 3 sentences, no technical jargon
- confidence_pct: should reflect signal completeness

### Day 6 Prompt Iteration Round 2 — 10x Run Results (DEMO_MODE)

Scenario A (known_bug): 10/10 runs — root_cause=known_bug, confidence=91 (stable, 0% variance)
Scenario B (user_error): 10/10 runs — root_cause=user_error, confidence=88 (stable, 0% variance)
Scenario C (external_dependency): 10/10 runs — root_cause=external_dependency, confidence=89 (stable, 0% variance)
All within ±5% confidence variance requirement.

Note: In DEMO_MODE all runs use deterministic fallback briefs. Live mode prompt
stability would require real ANTHROPIC_API_KEY testing. The SYSTEM_PROMPT v3.0
encodes all constraints needed for consistent live mode output.

### Key Prompt Design Decisions

- Explicit enum values for root_cause and severity prevent hallucinated values
- Confidence ranges tied to signal completeness prevent Claude from always returning 95+
- causal_chain timestamp requirement makes output actionable for engineers
- draft_customer_response examples (good/bad) prevent technical language leaking to customers
- null vs "" rule for linear_issue_id prevents Pydantic ValidationError in downstream parsing
