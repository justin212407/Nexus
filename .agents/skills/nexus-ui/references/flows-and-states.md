# Flows and states

These define the intended support experience. Check [backend-boundaries.md](backend-boundaries.md) before wiring any state or action to the present backend. Suggested fields below describe a future view model, not existing API fields.

## Review a ticket

1. Open the queue with retained filters. Combine persisted history and current events by ticket ID when that integration is in scope; do not add duplicate rows.
2. Select a ticket and preserve its position. Show available customer context, concise diagnosis/impact, and the suggested response. Acknowledge unavailable context explicitly.
3. Inspect evidence in place when needed. Returning to the response preserves text, cursor/focus where practical, and scroll position.
4. Edit the response. Maintain drafts keyed by environment and ticket ID. Distinguish an untouched generated draft from a dirty human edit; a new brief may offer a replacement but cannot silently overwrite it.
5. Open the chosen action preview. Confirm the exact content, ticket, audience, and destination. An edit or ticket change closes/invalidates that preview.
6. Confirm once, show pending state, and display the actual result. Failure retains the draft. Keep the operator on the ticket unless they explicitly choose a next-ticket action.

Avoid automatic selection changes on arrival, completion, sorting, or polling. If the selected row leaves its filter after an action, retain the detail with an explanation and a deliberate way to continue.

## Independent state axes

| Axis | Suggested states | Meaning |
| --- | --- | --- |
| Analysis | queued, analyzing, ready, failed | Whether a usable brief exists |
| Review | untouched, edited, previewing | Local operator preparation; not delivery |
| Reply delivery | idle, pending, confirmed, failed, uncertain | Outcome for one specific payload/audience |
| Escalation delivery | idle, pending, confirmed, failed, uncertain | Independent of customer reply |
| Resolution | open, resolved, unknown | Separate business fact; requires a reliable contract |
| Source coverage | finding, no-match, unavailable, not-checked, unknown | Distinguish only when reported; otherwise unknown |
| Connection | connecting, connected, reconnecting, offline | Freshness/transport, independent of analysis |
| Environment | loading, demo, live, unavailable | Backend-confirmed mode |

Derive queue groups from analysis/review work rather than the historical `done` label. Recommended order: **Needs attention → Ready for review → Analyzing**; within each group sort critical/high/medium/low/unknown, then newest first. “Needs attention” can contain analysis or delivery failures with a specific reason. Support filtering rather than mixing severity into lifecycle names.

Add an archive/resolved group only when persisted resolution is trustworthy. A success banner for a reply must not silently remove the ticket from the queue or imply the incident is fixed.

## Three action contracts

| Action | Preview content | Success means | Important limit |
| --- | --- | --- | --- |
| Customer reply | Exact edited text, customer identity, Intercom conversation | Confirmed customer-visible message for this ticket | Existing `/reply` does not currently implement this behavior |
| Internal note / Slack escalation | Exact internal content, ticket, diagnosis/impact/evidence and configured destination | Confirmed note/message accepted for that destination | Existing Slack endpoint constructs its own payload; accurate preview requires sharing that contract |
| Mark resolved | Exact state change and its scope | Resolution persisted and reflected in subsequent reads | Current endpoint conflates dispatch and resolution; do not imply it closes Intercom |

If a UI-only task cannot provide a truthful preview or outcome for a live action, leave that action unavailable with a concise capability explanation, or use clearly labeled isolated demo behavior. Document the missing contract for the developer. Do not substitute a working-looking control.

Keep pending state tied to the ticket and action. Disable duplicate confirmation while a request is in flight. A timeout can mean delivery happened but the response was lost: show “Delivery not confirmed” and a way to verify; automatic retries need backend idempotency. Treat a fresh explicit resend as a new action requiring review.

## Environment and sources

The demo area contains Checkout bug, Login investigation (the existing `false_alarm` scenario), and Payment provider outage. The friendly label can change without changing fixture keys. Show a persistent “Demo workspace” indicator and “Simulated” outcomes.

Backend mode must be known before enabling scenario controls. In live or unknown mode, scenario triggers are absent or disabled with an explanation. A local tab switch is not a backend mode switch. A database without environment provenance cannot support a trustworthy live/demo history filter; require separate storage or source metadata before making that promise.

Treat source availability and source matches separately. “Sentry available” only establishes a successful availability check. An empty `signals_used` list does not establish that every source was searched successfully. If source information is missing, say “Source details unavailable” rather than “All systems healthy.”

Preserve canonical enum values in data while using clear display labels. For `user_error`, prefer “User-side issue (suggested)” with appropriately cautious explanation. “No matching technical evidence” does not prove fault. Label raw identifiers only in developer-facing detail.

## Empty, waiting, and failure states

| Situation | Required behavior |
| --- | --- |
| Initial history load | Stable list skeleton or loading text; avoid flashing “No tickets” before the request completes |
| Empty live queue | Explain that incoming Intercom tickets appear here; offer a connection detail only if it exists |
| Empty demo queue | Explain the sample workspace and offer its scenario launcher |
| No filter matches | Keep filters visible and offer Clear filters |
| No selected ticket | Invite a selection; preserve useful queue context |
| Analyzing | Use observed stage text and an indeterminate indicator; permit reading available context |
| Slow analysis | Keep waiting state and a plain elapsed observation if measured; avoid invented remaining time |
| Analysis error | Explain failure, retain ticket, offer only an implemented retry path |
| Partial/unknown evidence | Keep draft readable with coverage limitations and evidence access |
| Disconnected stream | Retain the last known workspace, show stale/reconnecting status, reconcile after reconnect where supported |
| Dispatch failure | Keep exact draft and preview context; show failure, retry/verification appropriate to outcome certainty |
| Missing optional field | Omit the irrelevant row or render “Not provided”; display zero as zero |
| Mode lookup failure | Show mode unavailable; keep demo/live-dependent actions unavailable |

## Scenario-based acceptance

Use the actual current fixtures, not the older README narratives. Fixture content itself is sample/generated information, not verified production evidence.

- **Checkout bug:** show the response before technical detail; inspect the proposed deployment relationship. Preserve edits while another ticket completes. Do not fabricate a Linear link or timestamp if this fixture lacks it. A draft promising a recovery time remains unverified unless the source establishes it.
- **No matching signals:** present a helpful troubleshooting response and clear evidence limits. An empty signal list and high model confidence must not turn into a “systems healthy” success message.
- **External dependency:** make critical severity and affected service apparent. Customer response and engineering escalation have distinct previews. A Slack handoff does not resolve the ticket.
- **A → B → A:** edit A, open B, then return to A. Each ticket retains its own text, technical-disclosure state where appropriate, pending actions, and feedback. Test a new analysis event arriving while A is dirty.
- **Approval:** cancel causes zero outbound calls; confirmation causes one request for the exact approved payload. Change the ticket or draft while a preview is open and verify it cannot send stale content.
- **Reload/reconnect:** history and new events reconcile by ID without duplicate counts. State that cannot survive reload is labeled according to its real persistence. Do not treat replayed `completed` events as new deliveries.
- **Delivery error:** retain text after 4xx/5xx and timeout; distinguish known failure from uncertain delivery. Verify the destination before enabling an explicit retry.

For integration verification, stub outbound calls or use fixtures in confirmed demo mode with isolated persistence. Browser inspection alone must not send a live customer reply or Slack message.
