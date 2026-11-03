---
name: nexus-ui
description: Design, rebuild, or review the NEXUS support dashboard, including its ticket queue, customer response editor, engineering evidence, and approval flows. Use for this project's UI work; preserve its React/Vite stack and human-reviewed dispatch model.
---

# NEXUS UI

Build a support workspace where a person can understand a customer issue, review an AI-prepared response, verify the evidence, and approve the next action without losing their place.

## Product direction

The primary user is support/escalation staff; engineers are secondary users. Intercom brings in a ticket. NEXUS correlates Sentry, Slack, GitHub deployment, and Linear information through Coral, then prepares a `TechnicalBrief`. The useful output is a considered customer response and an informed handoff.

The core flow is **queue → select ticket → review response and context → edit → approve the exact action → dispatch**. Analysis completion, customer communication, engineering escalation, and resolution are separate events.

Use **NEXUS**, the current interface name. Older documents use Zenith; this skill does not rename the product.

Read the repository's [ui-decisions.md](../../../ui-decisions.md) when starting a new UI task. It records the settled product direction. This skill's dimensions, tokens, and component arrangements are recommended defaults, subordinate to explicit user direction. Read current implementation contracts before promising behavior; historical documentation is not evidence that a feature exists.

## Design defaults

- A light, compact support workspace: white work surfaces, quiet neutral navigation, graphite text, a restrained blue action/selection accent, fine dividers, and readable body text.
- A persistent ticket queue and a dominant response workspace. Technical evidence opens in place. Global analytics belongs in a secondary view or an explicitly opened panel.
- Customer context and the editable draft lead the page. Severity, service, and a short diagnosis support the decision. Pipeline machinery and confidence percentages remain secondary.
- Flat sections and rows establish hierarchy. Reserve a bordered container for the composer and overlays; avoid wrapping each field in another card.
- One primary action for the current task. Customer reply, internal note, Slack escalation, and resolution each name their audience and effect.
- Treat color as a semantic cue: selection/action blue, warnings amber, failures/critical severity red, confirmed success green. Root-cause categories remain neutral. Demo has an explicit persistent label.

For shell, component, typography, token, and responsive decisions, read [references/visual-system.md](references/visual-system.md). The values are NEXUS design choices, not measured competitor tokens.

## Work from the operator's decision

For a new screen or substantial rebuild:

1. Identify the operator's immediate task, the information needed to decide, the next action, and the actual data available. Check the relevant component and endpoint. For integrated flows, read [references/backend-boundaries.md](references/backend-boundaries.md); it records implementation mismatches discovered during research and where to recheck them.
2. Choose the smallest complete slice that serves the requested scope. For a full rebuild, start with a selected ticket, editable draft, evidence disclosure, and action preview in one working layout. Apply [references/flows-and-states.md](references/flows-and-states.md) to the affected flow. Record unsupported contracts separately from visual work.
3. Implement in the existing React/Vite frontend. Reuse its styling tooling and shared primitives; do not introduce a framework migration, a new service, or unrelated product areas as a consequence of applying this skill.
4. Verify the actual screen and the affected interaction, including its failure/recovery path. Use isolated demo fixtures or mocked requests for dispatch checks. Report implemented behavior, verification, and any unresolved contract dependency.

For a small component edit, load only the relevant reference and check that component in context. For a review, report deviations and their operator impact; do not silently turn the review into implementation.

## Interaction rules

- Keep selection, scroll position, filters, and unsent text stable while new tickets or analysis updates arrive. Key draft and action state by ticket ID and environment. A background update must not replace an edited draft.
- Render the draft as normal readable prose in an editor. Label it as AI-drafted and show its audience. Editing is preparation, not approval or dispatch.
- Bind approval to the current ticket, exact content, action, and destination. Changing any of them invalidates an open approval preview. Keep reply, escalation, and resolution independently reviewable.
- Represent source findings, model interpretation, and delivery outcome as different kinds of information. A provider logo, a high confidence value, or a completed pipeline is not delivery evidence.
- Show real source links only when supplied or verified. Present a bare issue ID as text when its URL is unknown. Describe missing timestamps or provenance honestly.
- Keep demo controls inside a named demo area, available only when the backend confirms demo mode. Mode loading/error is an unknown state. Label simulated delivery explicitly; a visual toggle cannot switch backend isolation.

## Completion checks

A substantial UI change is ready when the applicable checks pass:

- At 1440×900 and 1280×800, a selected ticket's identity, draft start, evidence control, and next action are legible without a wall of metadata above them. At 390px, the user can move queue → detail → back without page-level horizontal scrolling.
- A keyboard user can choose a ticket, edit, inspect evidence, open/cancel an approval preview, and resume in the same context. Focus is visible and overlays return it to their trigger.
- Switching ticket A → B → A preserves each ticket's own draft and action state. Incoming events do not steal focus. Long IDs, missing values, zero counts, and empty source lists render deliberately.
- Analysis failure, incomplete evidence, disconnected stream, empty queue, filtered-empty queue, and failed delivery produce distinct useful states. An uncertain delivery is not retried automatically.
- The preview names the audience and exact action. Cancel sends nothing; confirmation submits once. Success copy reflects what the endpoint actually accomplished.
- Backend changes required by a UI promise are implemented within authorized scope or identified as dependencies. A cosmetic confirmation dialog alone does not establish human-controlled dispatch.
- The relevant build and existing checks pass. Add behavioral tests where needed for draft isolation, approval, or event reconciliation; token/style edits do not require implementation-mirroring tests.

## Research rationale

Read [references/visual-research.md](references/visual-research.md) when deciding how to adapt a competitor pattern or explaining the visual direction. It links inspected official screenshots and the local UI audit. The full [product research](../../../docs/UI_PRODUCT_RESEARCH.md) covers Intercom, Plain, Pylon, Linear, Sentry, and incident.io with primary sources, reconstructed flows, and adoption boundaries.

Borrow the useful interaction principle, then fit it to NEXUS's evidence and approval model. Competitor features are not an expansion of this project's scope.
