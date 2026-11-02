# Backend and UI boundaries

Audit date: 28 October 2026. This is a dated map of pitfalls, not a replacement API specification. Recheck the named source files before implementing a dependent flow; update this reference when a gap is fixed. Paths below are relative to the repository root.

The settled workflow in `ui-decisions.md` requires human review and approval. The older pipeline documentation describes automatic dispatch. Preserve the intended workflow and make the integration work explicit; do not silently inherit older behavior because it already runs.

## Iteration 1 implementation update — 28 October 2026

The rebuild addressed the review, provenance, history, and draft gaps below. `api/actions.py` now accepts exact approved payloads for **persisted demo simulations only**; live actions are rejected. Pipeline dispatch performs no external sends. New `ticket_reviews` and `review_actions` sidecar tables keep original messages, environment, independent resolution, and idempotent action history. Existing incidents with unknown provenance stay separate.

The frontend hydrates history, reconciles events by ticket ID, preserves session drafts by ticket/environment, and previews exact content and destination. SSE now broadcasts per connected client, with history refresh on reconnection; it is still not a durable replay log. Insights computes its figures from unique loaded records and does not use the old `MetricsBar` or fixed-confidence `/stats` endpoint.

The evidence-record, live-stage-progress, durable processing, and production delivery limitations remain. See [the implementation report](../../../../docs/UI_ITERATION_1.md) and [current screen specification](../../../../specs/screens/support-workspace.md). The following table is the **pre-rebuild audit**, retained as rationale; it no longer describes the fixed implementation paths.

## High-impact mismatches

| Area | Observed source behavior | UI consequence / required dependency |
| --- | --- | --- |
| Customer reply | `api/actions.py` `/reply` calls `integrations/intercom.py:post_internal_note`. The formatter uses engineering content and omits `draft_customer_response`, even when the route overwrites that field. | “Send reply” and a preview of edited customer text would be false. A real reply requires an outbound customer-message contract. Merely relabeling the action “Internal note” still needs a preview matching the actual formatted note. |
| Automatic dispatch | `agents/dispatch_agent.py` posts an Intercom note, optionally Slack, during the pipeline, before UI approval. It returns `dispatched=True` even after delivery failures. | A frontend confirmation cannot enforce human-controlled delivery. Before a live rebuild promises approval gating, change/disable automatic external dispatch within the authorized implementation scope and expose real outcomes. |
| Resolution | `api/actions.py` `/resolve` calls `db/ops.py:log_dispatch`; that helper sets both `dispatched` and `resolved_at`. Automatic dispatch also calls it. `/history` omits these state fields. | There is no independent, queryable resolution lifecycle. Do not mark completed analyses resolved or claim Intercom was closed. A resolution workflow needs separate persistence/read behavior. |
| Slack preview | `/escalate` reconstructs context and formats stored brief content server-side; the route does not accept a custom message and the UI lacks the configured channel contract. | Display exact payload/destination only through a trustworthy preview/config contract; do not invent a channel name or promise arbitrary escalation editing. |
| Environment | `/health` supplies backend mode. Persisted incidents do not have a demo/live discriminator. The current header shows scenario controls in every mode. | Gate scenario controls on confirmed demo mode. Separate datasets/storage or add provenance before labeling individual historical records by environment. |
| Source records | `TechnicalBrief` has `signals_used` strings and a free-text `causal_chain`, not a structured record URL/timestamp for each claim. `linear_issue_id` is optional. | Render summary evidence honestly. Full source cards, verified timelines, and deep links require richer data. Do not construct a workspace-specific Linear URL from an ID alone. |
| Customer context | `started` SSE sends ticket ID only. `/history` includes customer email, brief, and creation time; it does not return the original message body. | Do not fabricate customer names or render the generated summary as the customer's message. A complete conversation view requires an enriched ticket contract. |
| Progress | `api/webhook.py` emits `coral_done`, `signal_done`, and `synthesis_done` after `nexus_graph.ainvoke` completes. Most events have no timestamp. | They establish milestones, not live stage duration. Use indeterminate progress until the backend emits stages at execution time; avoid synthetic percentage/countdown animations. |
| History/reconnection | `App.jsx` builds its queue from session SSE; history exists separately. `api/stream.py` uses one shared consuming queue rather than a replayable broadcast stream. | Hydration/reconciliation is needed for reliable reloads. Multiple clients may receive different events; UI work must not promise a complete multi-user realtime feed. |
| Draft isolation | `TechnicalBrief.jsx` initializes local response state from props once; selection can reuse that component. “Save draft” only changes local editing state. | Scope draft/feedback/approval state per ticket and show truthful persistence. Reinitializing on every brief change would instead overwrite edits; dirty-state handling is required. |
| Metrics | `/stats` returns a fixed average confidence of 75. `MetricsBar.jsx` can increment the last completed brief again when later events arrive; polling and local increments may overlap. | Omit unsupported average and deduplicate counts. Label persisted totals versus session/filtered counts. Use defined server aggregates or recompute from a known complete dataset. |

## Integration touchpoints

- `frontend/src/App.jsx`: shell, environment, selection, queue/event data. Keep request and state handling independent from visual composition as complexity grows.
- `frontend/src/components/TicketQueue.jsx`: row hierarchy and status/severity/recency ordering.
- `frontend/src/components/TechnicalBrief.jsx`: response, evidence, action previews, per-ticket state.
- `frontend/src/components/AgentStatus.jsx`: observed analysis milestones and source availability.
- `frontend/src/components/MetricsBar.jsx`: optional analytics and scope labels.
- `frontend/src/hooks/useSSE.js`: event lifecycle, stale state, reconnection cleanup.
- `models/brief.py`: canonical brief fields and classification enums. The confidence field is an integer without an explicit range constraint; handle malformed values honestly.
- `models/ticket.py`, `api/history.py`, `api/webhook.py`, `api/actions.py`, `db/ops.py`, and `integrations/`: authoritative payload and side-effect behavior.

Use relative frontend requests and the project's existing backend boundary. Correlated source retrieval remains through Coral; a UI rebuild is not a reason to add browser credentials or direct calls to Sentry, Slack, GitHub, or Linear.

## Safe scope choices

For visual-only work, improve hierarchy, responsive layout, evidence disclosure, queue behavior, and isolated demo review. Describe unavailable live capabilities in concise user-facing language such as “Customer replies are not available in this workspace”; put endpoint and migration details in the developer report.

For an authorized integrated rebuild, include the backend contracts needed for the selected flow. Verify payload equality, dispatch gating, independent outcomes, and rehydration. A disabled control is an honest interim state, not completion of an explicitly requested working feature.

An unavailable original message, source URL, ETA, or delivery receipt is a data requirement. Fill that gap deliberately or show it as unavailable. Never manufacture it to make a screenshot look complete.
