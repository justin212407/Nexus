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

---

## #19 - App shell: header, resizable queue, command palette

**Commit**: (this commit) `feat(ui): rebuild app shell with shadcn header, resizable queue and command palette`
**Date**: 2026-11-02
**Issue**: [#19](https://github.com/justin212407/Nexus/issues/19)

### Changes

- Rebuilt `App.jsx`'s shell with shadcn primitives while keeping all existing logic
  (`useWorkspace`, `useDrafts`, hash routing, filters, selection, demo loading):
  - Tailwind header (56px) with brand, workspace label, nav pills (Inbox, Insights, Demo lab),
    queue collapse toggle, connection status, environment `Badge`, and a Search button.
  - `ResizablePanelGroup` (react-resizable-panels v4) for the desktop queue/detail split with a
    collapsible queue panel driven by `panelRef` + `onResize`.
  - Command palette (`CommandDialog` + cmdk): Go to Inbox/Insights/Demo lab, fuzzy ticket search,
    and demo scenario triggers (demo mode only). Toggle with Cmd/Ctrl+K or the header button.
  - Mobile (<900px) stacked queue/detail views via `useIsMobile` (breakpoint changed 768 → 900).
  - Demo nav and palette entries are gated on `mode === "demo"` per the nexus-ui skill.
  - Error banner rebuilt with semantic warning tokens; skip link preserved.
- Moved `use-mobile.js` breakpoint to 900px to match the skill's responsive rules.
- Renamed the legacy CSS text tokens `--muted`/`--secondary` → `--ink-muted`/`--ink-secondary`
  because they collided with shadcn's token names and silently overrode `bg-muted`,
  making command-palette items render dark-on-dark.
- Fixed the generated `command.jsx` input row: `min-w-0` on the input and `shrink-0` on the
  addon so the search icon is not clipped.
- Added `aria-label` to the icon-only Search button (its text is hidden below `md`).

### Why

- The shell is the frame every other screen lives in; the queue/detail split is the operator's
  primary mental model, so it gets the resizable treatment while secondary views stay full-width.
- The command palette is the keyboard-first route to any ticket or view, matching the
  Linear-style interaction principle from the designeer.xyz research.

### Tradeoffs

- **Resizable panel split instead of the literal shadcn `Sidebar` primitive.**
  The left column is a data queue, not navigation; the shadcn Sidebar is designed for nav items
  (and the skill warns against filler nav rails). The resizable panel gives the same collapsible,
  persistent queue with drag control. If we later want the shadcn Sidebar chrome, it is a
  localized swap.
- **`use-mobile` breakpoint 900px** instead of shadcn's 768px default - matches the skill's
  "below 900px, queue and detail become separate views" rule.
- **Generated component source edited directly** (command.jsx) rather than restyling from App:
  the clipping bug lives in the primitive; fixing it there keeps every future CommandInput correct.
- **Legacy token rename** (`--muted` → `--ink-muted`) chosen over moving the shadcn `:root` later
  in the file, because moving it would invert which system breaks; the legacy CSS keeps its exact
  rendered output.

### Verification

- `npm run build` passes; `npm test` 14/14; `pytest` 49 passed, 3 skipped.
- Console errors: 0 after the fixes.
- Screenshots: `docs/screenshots/19-shell-desktop-1440.png`,
  `19-shell-desktop-1280.png`, `19-insights.png`, `19-command-palette.png`,
  `19-queue-collapsed.png`, `19-mobile-390.png`, `19-mobile-detail-390.png`.
- Screen recording: `docs/screenshots/19-shell-demo.webm` (collapse/expand, Cmd+K, nav switch).
- Verified interactions: queue collapse (0px) and expand, Cmd/Ctrl+K opens the palette,
  mobile queue → detail → back, no horizontal scrolling at 390px.

---

## #21 - Review workspace: shadcn tabs, editor, approval dialog, toasts

**Commit**: (this commit) `feat(ui): rebuild review workspace with shadcn tabs, editor and approval dialog`
**Date**: 2026-11-02
**Issue**: [#21](https://github.com/justin212407/Nexus/issues/21)

### Changes

- Rebuilt `TechnicalBrief.jsx` on shadcn primitives with all existing logic preserved
  (`prepare`/`confirm`, request-ID retry, double-submit guard, draft dirtiness,
  approval invalidation on content/destination change, demo-only actions):
  - `Tabs` (line variant) for Conversation / Activity with the approved-content disclosure.
  - `Textarea` composer in a bounded card with AI-drafted label, recipient row,
    edited indicator + Restore AI draft.
  - `Button` actions: Review reply (primary), Escalate (ghost), Mark resolved (ghost, right).
  - `Dialog` approval preview with ticket, destination, action, exact content,
    Cancel and action-specific confirm labels; error alert keeps retry copy.
  - `Sonner` toast on success/failure, in addition to the persistent inline status notice
    (`role="status"`) and Activity record.
  - `Badge` for severity/imported history; semantic state dot.
- Mounted `<Toaster />` in `App.jsx`.
- Fixed generated `tabs.jsx` orientation variants: Base UI emits `data-orientation="horizontal"`
  but the generated classes used Tailwind's `data-horizontal:` literal-attribute variant,
  so the tab list and panel laid out side-by-side. Replaced them with
  `group-data-[orientation=...]/tabs:` variants.
- Made the generated `Button` forwardRefs so Base UI's `render` prop (dialog close) attaches
  its ref without the "Function components cannot be given refs" warning.

### Why

- The review workspace is the product's core decision surface; its primitives must match
  the shell's design system and support keyboard/dialog semantics without custom modal code.
- Keeping every behavior identical means the existing behavioral tests continue to guard
  approval binding, retry semantics and action availability.

### Tradeoffs

- **Kept `EvidencePanel` (custom drawer) unchanged** rather than rebuilding it with shadcn
  `Sheet` in this issue. It already satisfies the evidence-disclosure rules; swapping it is
  cheap later and avoids widening this PR's risk. Tracked for #25 visual QA.
- **Sonner toasts added alongside the inline notice** instead of replacing it - the skill
  requires a persistent record of action outcomes; toasts alone would violate that.
- **Dialog via Base UI** instead of the previous custom `Modal`: less code, correct focus
  handling. Verified the existing dialog tests still pass unchanged.

### Verification

- `npm run build` passes; `npm test` 14/14 (including approval-cancel, double-submit,
  invalidation, retry and disabled-action tests); `pytest` 49 passed, 3 skipped.
- Console errors: 0.
- Artifacts: `docs/screenshots/21-before-review-1440.png`, `21-before-approval.png`,
  `21-after-review-1440.png`, `21-after-approval.png`, `21-after-activity.png`,
  `21-after-mobile.png`, `21-review-flow.webm`.

---

## #20 - Ticket queue: shadcn rows, filters, skeletons

**Commit**: (this commit) `feat(ui): rebuild ticket queue with shadcn rows, filters and skeletons`
**Date**: 2026-11-02
**Issue**: [#20](https://github.com/justin212407/Nexus/issues/20)

### Changes

- Rebuilt `TicketQueue.jsx` with Tailwind + shadcn primitives, keeping the same props contract:
  - Search `Input` with icon and clear action.
  - Status `Tabs` (line variant) for Open / All / Resolved.
  - Severity and environment `Select`s with explicit `items` label maps.
  - Grouped rows (status → severity → recency order comes from `sortTickets`), sticky group
    headers with status dot and count, two-line subject clamp, mono ticket code, severity ink.
  - Selected row: tinted accent + persistent left accent bar + `aria-current`.
  - `Skeleton` loading rows; deliberate empty states (filtered vs caught-up vs demo CTA).
  - Footer assurance line.
- Fixed the Select triggers showing raw values (`all`, `current`); Base UI needs an `items`
  label map for `SelectValue` to render labels.

### Why

- The queue is the operator's entry point; shadcn rows keep density while matching the shell.
- Explicit label maps avoid leaking internal filter keys into the interface.

### Tradeoffs

- **List of card-like rows instead of shadcn DataTable** (as flagged during planning):
  a live SSE-fed triage list with grouped status sections reads better as rows; DataTable's
  sorting/faceting machinery would duplicate state we already own in `sortTickets`.
- **Native-like compact Selects** styled borderless inside the filter row to keep queue density;
  they still use shadcn Select for consistent keyboard/menu behavior.

### Verification

- `npm run build` passes; `npm test` 14/14; zero console errors.
- Search filtering, severity filtering, ticket selection and refresh exercised (recording).
- Artifacts: `docs/screenshots/20-before-queue-1440.png`, `20-after-queue-1440.png`,
  `20-after-queue-390.png`, `20-queue-flow.webm`.

---

## #22 - Motion polish: tickers, spotlight, hover transitions

**Commit**: (this commit) `feat(ui): add motion polish with number tickers, spotlight and hover transitions`
**Date**: 2026-11-02
**Issue**: [#22](https://github.com/justin212407/Nexus/issues/22)

### Changes

- Added `motion` (motion.dev, v14) as the animation runtime.
- `components/motion/NumberTicker.jsx` - Aceternity-style count-up that animates when in view,
  formats with `toLocaleString`, and jumps straight to the value under reduced motion.
- `components/motion/Spotlight.jsx` - subtle ambient radial spotlight for empty states only
  (decorative, pointer-events-none, static under reduced motion).
- Insights stat values now use the ticker.
- Queue rows: 150ms background/shadow transition plus a restrained inset hover shadow
  (Aceternity card-hover principle, kept subtle for a productivity surface).
- Existing Base UI dialog enter/exit animation (`data-open:animate-in fade-in zoom-in-95`,
  100ms) verified as-is; skeleton pulse retained.

### Why

- The designeer.xyz inspiration (Linear / Emil Kowalski direction) is about purposeful,
  quick motion - it should communicate state changes, not decorate a workspace.
- The ticker makes metric changes legible without a table of numbers shifting silently.

### Tradeoffs

- **No `framer-motion`-heavy layout animation on list rows.** Layout animations on a live
  SSE list risk fighting scroll position and focus; the skill requires selection/scroll
  stability while updates arrive. Hover and dialog motion carry the polish instead.
- **Spotlight restricted to the empty state.** A persistent background effect would compete
  with evidence reading on the review surface.
- **Reduced motion handled twice**: global CSS zeroes CSS animations, and the motion
  components consult `useReducedMotion` so JS-driven values render immediately.

### Verification

- `npm run build` passes; `npm test` 14/14; zero console errors.
- Recording shows the Insights count-up, queue hover transition and dialog animation.
- Artifacts: `docs/screenshots/22-before-insights-1440.png`,
  `22-after-insights-1440.png`, `22-motion-flow.webm`.

---

## #23 - Analytics: shadcn charts, live metrics, real average confidence

**Commit**: (this commit) `feat(ui): rebuild insights with shadcn charts and real average confidence`
**Date**: 2026-11-02
**Issue**: [#23](https://github.com/justin212407/Nexus/issues/23)

### Changes

- Backend: `/stats` now returns `get_avg_confidence()` instead of the hard-coded `75`
  (the gap called out in `report.md` §8). Updated `tests/test_history_main.py` to assert the
  real value via monkeypatch.
- Rebuilt `Insights.jsx` on shadcn `Card`, `Table`, and `Chart` (recharts):
  - Four stat cards with `NumberTicker` values and scope hints.
  - Classification and severity horizontal bar charts with count labels, including
    deliberate `0` labels via `minPointSize` stubs.
  - Severity bar palette uses surface-friendly tones (red/amber/slate/blue) rather than the
    dark warning ink token.
  - Services table with tickets, critical count, share bar and percentage.
  - Dataset scope in the header (`Demo · Loaded history`) and footer (ticket count, refresh time).
  - Explicit empty state when no analysed tickets exist.
- Live recalculation remains driven by the workspace tickets (SSE + history), so completed
  briefs update every number and chart without an extra poll.

### Why

- The skill's analytics guidance: secondary Insights surface, real counts, labeled horizontal
  breakdowns, stated scope, no unsupported averages. The previous page already followed that
  shape; this rebuild moves it onto the component system and fixes the fake confidence number.

### Tradeoffs

- **recharts via the shadcn chart wrapper** instead of Tremor: shadcn chart is already part of
  our registry workflow and keeps the token story consistent. Bundle cost accepted for a
  secondary route.
- **Single-hue classification bars**: the skill says root-cause categories do not each need a
  saturated colour; severity carries the semantic palette.
- **Average confidence only appears via `/stats`**: `MetricsBar` (legacy) is untouched in this
  issue; it is removed in the cleanup issue.

### Verification

- `npm run build` passes; `npm test` 14/14; `pytest` 49 passed, 3 skipped.
- `/stats` now returns `avg_confidence_pct: 89.7` on the demo DB (was 75).
- Zero console errors; charts, zero labels, tooltip and services table exercised.
- Artifacts: `docs/screenshots/23-before-insights-1440.png`,
  `23-after-insights-1440.png`, `23-analytics-flow.webm`.

---

## #24 - Demo/live separation and mode states

**Commit**: (this commit) `feat(ui): guard demo lab behind confirmed demo mode`
**Date**: 2026-11-02
**Issue**: [#24](https://github.com/justin212407/Nexus/issues/24)

### Changes

- Demo route guard: `#demo` renders `DemoLab` only when `/tickets/config` confirms
  `mode === "demo"`. Otherwise it renders a dedicated `DemoUnavailable` state
  (checking vs unavailable) with a Back to inbox action - no scenario controls exist in
  live/unknown mode, even via direct URL.
- Header environment badge distinguishes three states: `Checking mode…` while the config is
  still loading, `Mode unavailable` after a failed/absent config, and `Live workspace`/`Demo
  workspace` when known.
- Demo nav entry, command-palette Demo lab entry, palette demo scenarios and the empty-state
  demo CTA were already gated on demo mode; this issue closes the route loophole.
- Simulation copy stays explicit in the review workspace (`review-assurance` note and the
  success toast both state no external message is sent). Backend `/demo/samples` already
  returns 409 outside demo mode.

### Why

- The skill requires demo controls to exist only when the backend confirms demo mode, and
  treats mode loading/error as an unknown state. A visual toggle must not be able to imply
  isolation the backend is not enforcing.

### Tradeoffs

- **Route guard in the client, not a redirect.** Keeping the URL lets the user retry once
  the backend recovers or mode loads; the state explains what is happening rather than
  silently bouncing them.
- **No extra mode polling.** Mode rides on the existing 15s config refresh; the badge and
  guard derive from it, so there is one source of truth.

### Verification

- `npm run build` passes; `npm test` 14/14.
- Mocked `/tickets/config` 500: `#demo` shows the unavailable state, demo controls absent,
  badge reads "Mode unavailable".
- Normal demo mode: Demo lab renders, zero console errors.
- Artifacts: `docs/screenshots/24-before-mode-unknown.png`, `24-after-mode-unknown.png`,
  `24-after-demo-mode.png`, `24-demo-mode-flow.webm`.

---

## #25 - Cleanup: rebuild remaining surfaces, delete dead code, purge legacy CSS

**Commit**: (this commit) `refactor(ui): rebuild remaining surfaces and remove legacy stylesheet`
**Date**: 2026-11-02
**Issue**: [#25](https://github.com/justin212407/Nexus/issues/25)

### Changes

- Rebuilt the last legacy-styled surfaces with Tailwind + shadcn:
  - `EvidencePanel` -> shadcn `Sheet` drawer (same content: brief summary, facts, sources,
    narrative, recommended step, ETA note).
  - `AgentStatus` -> Tailwind processing/failure view with the same `role="status"` /
    `role="alert"` semantics and copy.
  - `DemoLab` -> shadcn `Card`/`Button`/`Badge` scenario lab with the same scenarios,
    disabled logic and copy.
  - App empty state, processing wrapper, filtered-selection notice -> Tailwind; skip link kept
    as the one global utility.
- Deleted dead components: `MetricsBar.jsx`, `MetricsBar.css`, `Modal.jsx`
  (replaced by shadcn Sheet/Dialog).
- Pruned `frontend/src/index.css` from ~2,700 lines to ~280: imports, NEXUS tokens, `@theme`
  inline mapping, base layer, scrollbars, skip link, reduced-motion guard. Added the missing
  `--color-ink-secondary` / `--color-ink-muted` theme mappings (these classes were previously
  inert).
- Keyboard pass: tab order reaches every shell/queue/review control with accessible names;
  dialog focus moves inside and returns to the `Review reply` trigger on Escape; the skip
  link is focusable.
  Known limitation: react-resizable-panels v4's Separator ignores custom attributes, so the
  resize handle announces only `separator` + orientation, without a name.

### Why

- The CSS purge is the payoff of the epic: every surface now consumes the shared token
  system, so there is one place to change colour, radius or typography.
- Removing MetricsBar/Modal closes the last consumers of the old styles.

### Tradeoffs

- **Kept `Icon.jsx`** for the brand logo only; it is a 2KB SVG helper and replacing it with a
  lucide mark would change the NEXUS identity for no functional gain.
- **Removed the resize-handle label attempt** rather than patching vendor attributes at
  runtime; documented instead.
- **Did not delete the `useWorkspace` polling design** (15s reconciliation) - it backs the
  SSE stream and is intentional, not legacy UI.

### Verification

- `npm run build` passes; `npm test` 14/14; `pytest` 49 passed, 3 skipped.
- Zero console errors across Inbox, review, evidence sheet, Insights and Demo lab.
- Keyboard/dialog focus checks scripted and passing.
- Artifacts: `docs/screenshots/25-before-evidence-drawer.png`, `25-after-evidence-sheet.png`,
  `25-before-demo-lab.png`, `25-after-demo-lab.png`, `25-after-review-1440.png`,
  `25-after-mobile.png`, `25-cleanup-flow.webm`.

---

## Epic wrap-up (#17)

**Commit**: (this commit) `docs(ui): add epic verification artifacts and wrap-up`
**Date**: 2026-11-02
**Issue**: [#17](https://github.com/justin212407/Nexus/issues/17)

### What shipped

| Issue | Change | PR |
| --- | --- | --- |
| #18 | shadcn/ui + Tailwind v4 + NEXUS tokens, Geist, 25 components | on `ui-revamp` (commit `3074895`) |
| #19 | Shell: header, resizable queue, command palette (Cmd+K), mobile stack | on `ui-revamp` (commit `58b9a19`) |
| #21 | Review workspace: tabs, editor, approval dialog, Sonner | #26 |
| #20 | Queue: shadcn rows, filters, skeletons | #27 |
| #22 | Motion: number tickers, spotlight, hover transitions | #28 |
| #23 | Insights: shadcn charts, real average confidence | #29 |
| #24 | Demo/live separation and mode states | #30 |
| #25 | Cleanup: remaining surfaces rebuilt, legacy CSS purged (2,700 → 280 lines) | #31 |

### Final state

- One design system: NEXUS tokens mapped into shadcn CSS variables, one stylesheet.
- Every screen runs on owned shadcn source in `src/components/ui/`.
- Queue → review → approve → dispatch flow with request-bound approvals, draft isolation,
  Sonner + inline outcome records, and demo-only actions.
- Backend contract unchanged except `/stats` now returns the real average confidence.

### Tradeoffs carried forward

- Base UI primitives (shadcn default) are newer than Radix; the source is vendored so fixes
  are local (we already patched tabs orientation, dialog refs, command input clipping).
- The resizable separator cannot be labelled (vendor ignores attributes); documented.
- `Icon.jsx` remains for the brand mark only.

### Verification

- `npm run build` passes; `npm test` 14/14; `pytest` 49 passed, 3 skipped.
- Zero console errors across every view at 1440x900, 1280x800 and 390x844.
- Epic artifacts: `docs/screenshots/epic-before-main-1440.png`,
  `epic-after-1440.png`, `epic-tour.webm`.









