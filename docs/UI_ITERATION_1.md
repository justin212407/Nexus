# NEXUS UI — iteration 1

Implemented 28 October 2026 using the project [NEXUS UI skill](../.agents/skills/nexus-ui/SKILL.md). The React/Vite application now provides Inbox, Insights, and Demo lab around the agreed human review workflow.

## What changed

- **Inbox:** persistent searchable queue, severity/status filters, separate imported history, original customer message, concise diagnosis, editable response, previous/next navigation, and mobile queue/detail navigation.
- **Evidence:** an in-context drawer with the technical brief, named sources, model confidence, untimed analysis narrative, recommended action, and explicit source limitations. Unknown source URLs are not invented.
- **Review:** exact content/destination previews, cancellable approvals, explicit failure/retry, and independently recorded reply, Slack escalation, and NEXUS resolution. Activity shows the approved payloads.
- **Drafts:** per-ticket and per-environment text survives navigation and reload within the same browser tab. This is browser session storage, not a shared server draft service.
- **Insights:** unique loaded ticket counts and classification, priority, and service distributions. The scope is the current environment within the latest 100 loaded records; it is not all-time analytics.
- **Demo lab:** six fictional tickets across three scenarios, loaded explicitly and idempotently. Existing sample actions are preserved.
- **Visual system:** a light workspace, blue selection/action accent, flat queue rows, restrained metadata, readable composer, responsive layouts, visible focus, reduced motion, and focus-managed dialogs. Customer labels use the available email handle; full names are not inferred.

## Supporting backend changes

New sidecar SQLite tables preserve the original message, environment provenance, independent resolution, and exact simulated action records. Existing incidents are retained; records without provenance remain imported history. Reprocessing an existing legacy record does not guess its environment.

`GET /tickets/config` reports the backend mode and configured escalation destination. `POST /tickets/{id}/{reply|escalate|resolve}` records approved **demo simulations only**, with an idempotency key. Both backend mode and ticket provenance are enforced. `POST /demo/samples` adds deterministic fixtures only in demo mode.

The pipeline dispatch stage now finishes analysis without posting an Intercom note or Slack message. This makes review meaningful: analysis completion does not perform an outbound action. SSE broadcasts separately to connected clients; reload/reconnection and a 15-second history refresh reconcile saved records.

## Run the isolated preview

From the repository root, start the API in one terminal:

```bash
DEMO_MODE=true DATABASE_URL=sqlite:////tmp/nexus-iteration1-preview.db \
  python3 -m uvicorn main:app --host 127.0.0.1 --port 8011
```

Start the frontend in another terminal:

```bash
cd frontend
NEXUS_API_URL=http://127.0.0.1:8011 npm run dev -- --host 0.0.0.0 --port 5174 --strictPort
```

Open <http://localhost:5174>. Demo lab → Load sample workspace initializes an empty preview. Existing records in the project's normal database are not used by this preview.

The visual walkthrough is [`.lavish/nexus-iteration-1.html`](../.lavish/nexus-iteration-1.html). Open it with `npx -y lavish-axi .lavish/nexus-iteration-1.html`. It includes real screenshots of the running application; the original shell capture is explicitly identified as an empty-queue baseline.

## Verification

- Frontend: **14 tests passed** across reconciliation, stale events, draft isolation/storage fallback, exact approval, cancellation, duplicate confirmation, approval invalidation, explicit retry, and analysis/error presentation.
- Backend: **49 passed, 3 skipped**. The skipped checks require live Coral; tests ran with demo mode and an isolated test database. New coverage includes exact persistence/idempotency, independent resolution, environment/destination gates, legacy provenance, sample loading, no automatic external dispatch, and SSE fan-out.
- Production Vite build passes. Existing Vite CJS and Python dependency deprecation notices remain.
- Browser: sample loading; search/filtered-empty; priority filter; A→B→A draft preservation; exact preview and cancellation; action error/retry; reply/escalation/resolution persistence; reload; activity; Insights; Demo lab; Escape/focus restoration; mobile queue→detail→queue.
- Inspected at **1440×900**, **1280×800**, and **390×844**. The primary action is visible on the laptop layout. Inbox, Insights, Demo lab, detail, and approval show no page-level horizontal overflow in the checked views. Final app console has no errors.

## First-iteration boundaries

**Live external delivery is disabled.** Demo reply/escalation records do not send to Intercom or Slack. Resolution changes only the NEXUS review record. Production customer-visible messaging, authorization, delivery receipts, and recovery after ambiguous provider outcomes need a later integration contract.

Evidence remains a generated brief with referenced source names, not verified original records. Source URLs, structured timelines, and additional customer profile fields require richer upstream data. Demo lab loads existing prepared brief fixtures; it does not demonstrate a fresh live investigation.

The stream has no durable event replay and uses per-process subscribers. Completed records recover through history; an in-flight analysis may not be recoverable after a server restart. A durable processing job store and shared event transport are later work if needed.

The former `MetricsBar` and `/stats` endpoint are not used by the rebuilt UI. The legacy endpoint still contains its pre-existing fixed confidence estimate; all displayed Insights values are computed from loaded unique tickets instead.

Existing unrelated local edits were preserved. No commit, PR, deployment, or external publication was performed.
