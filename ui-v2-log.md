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

---

## #18 - Foundation: shadcn/ui + Tailwind v4 + NEXUS tokens

**Commit**: (this commit) `feat(ui): adopt shadcn/ui on Tailwind v4 with NEXUS design tokens`
**Date**: 2026-10-28
**Issue**: [#18](https://github.com/justin212407/Nexus/issues/18)

### Changes

- Migrated `frontend/` from Tailwind v3 to **Tailwind v4** with the `@tailwindcss/vite` plugin.
  Deleted `tailwind.config.js` and `postcss.config.js` (v4 is CSS-first).
- Ran **shadcn init** (shadcn CLI 4.23, `base-nova` preset, **Base UI** primitives, Lucide icons).
  Created `components.json` and the `@` path alias in `vite.config.js` + `jsconfig.json`.
- Added 25 shadcn components to `src/components/ui/`: button, card, badge, dialog, alert-dialog,
  tabs, textarea, input, label, separator, skeleton, sonner, tooltip, dropdown-menu, scroll-area,
  toggle, select, alert, progress, resizable, command, sheet, avatar, breadcrumb, table, sidebar
  (plus the generated `use-mobile` hook).
- Wrote the **shadcn theme token block** in `src/index.css`: NEXUS visual-system palette
  (canvas `#F6F7F9`, surface `#FFFFFF`, text `#182230`, action `#2459D3`, selected `#EDF3FF`,
  divider `#E2E6EC`, semantic success/warning/error pairs, chart and sidebar tokens)
  mapped into shadcn CSS variables with a `@theme inline` layer, plus a dark-mode `.dark` block.
- Installed **Geist Variable** via `@fontsource-variable/geist` and set it as `--font-sans`
  ahead of the existing Inter/system stack.
- Added `frontend/.npmrc` with `include=dev` and set `NODE_ENV` explicitly in the
  `dev`/`test` npm scripts.
- Marked `frontend/package.json` as `"type": "module"` (required by ESM-only `@tailwindcss/vite`).

The ~2.5k lines of hand-rolled CSS in `index.css` are intentionally untouched:
the current screens still render from them; they are replaced screen-by-screen in #19-#21
and deleted in #25.

### Why

- Everything else in the epic (#19 shell, #20 queue, #21 review) consumes these primitives.
- Tailwind v4 + latest shadcn is the maintained path (shadcn made Base UI its default
  component layer in July 2026), and the v2 rebuild replaces the class consumers anyway,
  so migration risk is minimal.

### Tradeoffs

- **Tailwind v4 + shadcn 4.23 (Base UI)** vs staying on Tailwind v3.4 + shadcn 2.3 (Radix).
  Chose v4/Base UI: the older stack is legacy, and since v2 rewrites every screen on shadcn
  primitives, there is little saved work in pinning the old majors.
  Risk accepted: Base UI components are newer than Radix; mitigated by the fact that
  shadcn ships them as source we own in `src/components/ui/`.
- **Wrote the theme CSS by hand** instead of letting `shadcn init` finish.
  The CLI's init step hangs in this environment (its `add` command works fine), and #18's
  deliverable is the NEXUS palette mapped into shadcn variables anyway - the preset's
  default neutral grays would have been overwritten regardless.
- **Kept the old hand-rolled CSS during migration** vs deleting it now.
  Deleting now would break every current screen before their shadcn replacements exist;
  coexistence keeps each sub-issue independently shippable.
- **`--input` border token** is set to `#D1D8E3` (between the skill's divider `#E2E6EC` and
  control-border `#7B8798`); exact value needs visual QA during #25.

### Verification

- `npm run build` passes (CSS bundle includes utilities, tokens, and Geist subsets).
- `npm test` - 14/14 frontend tests pass.
- `pytest` - 49 passed, 3 skipped.
- Dev server smoke test: HTML, `index.css`, and shadcn components all serve correctly.

