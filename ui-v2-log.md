# NEXUS UI v2 - Build Log

A running record of the UI Redesign v2 work (epic #17).
Each entry corresponds to one commit and records what changed, why, and the tradeoffs behind non-obvious decisions.

Format per entry:

- **Commit**: short hash, message, date
- **Issue**: the sub-issue it advances
- **Changes**: what actually changed
- **Why**: the reasoning
- **Tradeoffs**: alternatives considered and why they were rejected

---

## Baseline snapshot

**Commit**: `feat: pre-v2 snapshot - v1 Tailwind rebuild, actions API, workspace WIP`
**Date**: 2026-10-28
**Issue**: none (housekeeping)

### Changes

Snapshot of all uncommitted work on `ui-revamp` before the v2 component-system rebuild begins:

- v1 dashboard rebuild (plain Tailwind): App.jsx, TicketQueue, TechnicalBrief, MetricsBar, AgentStatus restyled inline.
- Backend: `api/actions.py` (reply/escalate/resolve endpoints), `api/demo.py`, dispatch/stream/db modifications and matching tests.
- Docs: `report.md`, `ui-decisions.md`, `docs/UI_PRODUCT_RESEARCH.md`, `docs/UI_ITERATION_1.md`, `specs/`, `plans/`.
- Project skill: `.agents/skills/nexus-ui/`.
- WIP from the earlier skill-built UI: DemoLab, EvidencePanel, Insights, Modal, Icon, useWorkspace, workspace lib.

### Why

The v2 rebuild replaces most of the frontend component code.
Committing the current state first keeps every v2 commit's diff clean and reviewable - otherwise v2 changes would be tangled with a pile of unrelated uncommitted files.

### Tradeoffs

- Considered reverting the WIP components (DemoLab etc.) instead of committing them.
  Rejected: they document the previous attempt and some contain reusable contract research; deleting in-progress work loses context.
  They will be removed deliberately in the cleanup sub-issue (#25).
- `.commandcode/` and `.lavish/` are local tooling state, added to `.gitignore` rather than versioned.
