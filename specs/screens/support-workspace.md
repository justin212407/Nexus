# Support workspace — first iteration

## Scope and principles

Implement the [agreed review workflow](../../ui-decisions.md) with the [NEXUS UI skill](../../.agents/skills/nexus-ui/SKILL.md). Support staff review a response before taking an action. Preserve context and human edits over background refreshes. Distinguish observed evidence, generated interpretation, and recorded actions.

This iteration provides the complete review experience in an isolated, explicitly labeled demo mode. Live outbound delivery is unavailable until its production contract is implemented. Completing analysis never automatically sends a message. Resolution in this iteration means marking a ticket resolved in NEXUS, not closing its Intercom conversation.

## Navigation

The existing React/Vite application provides a Queue, Insights, and Demo lab. Navigation retains the queue's filter, selection, and unsent drafts. On mobile the queue and ticket detail are separate views with a return action. Evidence opens inside the selected ticket; it does not replace its draft.

## Data and environment

- Load persisted history and reconcile stream updates by ticket ID. Refresh history after completion, actions, and reconnection. Counts are derived from unique records, never increments applied to replayed events.
- Read environment from the backend. New records carry their actual environment and original customer message. Historical records lacking provenance appear in an explicitly separate imported-history view, with unavailable delivery actions.
- Demo samples are fictional, deterministic fixture records loaded by an explicit demo-only action. Repeated sample loading is idempotent. Demo actions are recorded simulations and never call external integrations.
- Insights describes the loaded history scope and current environment. It shows real ticket counts and classification/severity/service distributions. No SLA, response-time, accuracy, or unmeasured trend claims.

## Queue and detail

- Search across available customer email, ticket ID, message, summary, and service. Filter by review state and severity. Show clear empty, filtered-empty, loading, error, and stale states.
- Sort actionable review states before analyzing/resolved records, severity within each group, then newest first. An incoming event does not change the selected ticket or overwrite a draft.
- A ticket shows identity, actual customer message when available, concise diagnosis, severity, service, and the editable customer response. Missing original messages are identified as unavailable.
- Drafts are isolated by environment and ticket ID and retained for the browser session. Draft saving copy describes that actual persistence. Replacing the generated draft is an explicit operator action.
- Evidence distinguishes source names mentioned in analysis from verified source records. Untimed narrative is a list, not a timestamped timeline. Confidence is labeled a model assessment. Unknown URLs are not fabricated.
- Activity shows stored review actions independently of the evidence narrative. Analysis-ready, replied, escalated, and resolved are distinct states.

## Approval and action contract

- Opening a preview performs no dispatch. Preview contains ticket, audience/destination, exact body or resolution effect, and an explicit simulation label in demo.
- Confirming once records one action with an idempotency key; cancellation records nothing. Changing ticket or draft invalidates a preview. An in-flight or uncertain action cannot be silently resubmitted with a new key.
- Reply records the exact edited response. Slack escalation records the exact displayed internal text and configured destination. Resolution changes only the NEXUS review record.
- Actions require both demo backend mode and demo record provenance. Live and imported-history actions are rejected server-side, not merely hidden.
- Failed actions preserve the draft. Delivery status must match the returned outcome. No generated brief or `completed` SSE event implies an action happened.

## Presentation and verification

Use the skill's visual system. Verify desktop at 1440×900 and 1280×800 and mobile at 390px. Keyboard users can select tickets, edit, inspect evidence, and open/cancel previews; dialogs trap focus, close with Escape, and return focus. Reduced motion and visible focus are supported.

Present the finished iteration in a local Lavish review artifact using actual screenshots and the project's visual system, with a link to the running dashboard. Do not publish it externally.
