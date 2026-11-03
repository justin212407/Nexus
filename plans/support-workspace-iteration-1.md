---
status: done
depends: []
specs:
  - specs/screens/support-workspace.md
---

# Support workspace, iteration 1

## Scope

Rebuild the existing frontend around ticket review, evidence, approval, Insights, and a separate demo lab. Add the minimal data contracts for persistent demo review and provenance. The user's request authorizes implementation using the existing agreed direction.

## Implements

[Support workspace specification](../specs/screens/support-workspace.md).

## Approach

1. Preserve existing work and record the baseline. Add review metadata and idempotent simulated action persistence, hydrate history, and stop automatic outbound pipeline dispatch.
2. Build the responsive shell, searchable queue, response workspace, evidence/activity surfaces, Insights, and demo controls.
3. Verify behavior and layouts, prepare a Lavish review of the real app, and document changes and limits.

## Validation

- [x] Backend tests prove no automatic sends, environment gating, exact approved payloads, idempotency, independent resolution, and persistence. Full suite: 49 passed, 3 live Coral checks skipped.
- [x] Frontend checks cover event reconciliation, draft isolation, and approval behavior; 14 tests and the production build pass.
- [x] Browser checks cover demo loading, search/filters, edit/evidence/approval/cancel/action, action failure/retry, reload, Insights, and mobile navigation.
- [x] Desktop 1440×900, laptop 1280×800, and mobile 390×844 layouts inspected; no page-level horizontal overflow.
- [x] Lavish review opened with actual screenshots and a working dashboard link.

## Risks / unknowns

Existing historical data has no environment provenance. Keep it separate instead of guessing. Production delivery remains unavailable in this UI iteration. Existing unrelated edits must be preserved.

## Notes

Local implementation requested; no commit, PR, merge, or external publication is part of this task.

Completed 28 October 2026. See [the change report](../docs/UI_ITERATION_1.md) for verification, preview commands, and limitations. The local Lavish artifact is `.lavish/nexus-iteration-1.html`; the running demo uses a separate database.

## Follow-ups

Deferred to a later iteration: production delivery and authorization, verified source records, and durable analysis/event recovery. These are outside the explicitly simulated first-iteration contract and are described in the change report.
