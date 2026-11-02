# Visual research and adaptation

Inspected on 28 October 2026. This record separates visible evidence from NEXUS recommendations. The [full research report](../../../../docs/UI_PRODUCT_RESEARCH.md) covers six products and 17 primary sources. The images below are official published examples, some historical or promotional; they do not establish current authenticated behavior. Competitor assets are references, not assets to ship in NEXUS.

## Screens actually inspected

| Reference and original image | Visible observation | NEXUS adaptation |
| --- | --- | --- |
| [Plain thread redesign, Jan 2026](https://www.plain.com/blog/january-product-update) · [image](https://framerusercontent.com/images/LjXlUbsL0NAMdGEQlnawcqTkN8.png) | Clear issue title; quieter ID/channel/age; readable messages; internal note uses an amber surface and explicit audience exclusion. | Keep customer text and draft dominant. Name the audience of internal material. The green promotional backdrop is outside the product surface and should not become the workspace background. |
| [Pylon Copilot](https://docs.usepylon.com/pylon-docs/support-workflows/issues/copilot) · source drawer screenshot embedded below “Draft Response” | Composer remains visible alongside a flat source list; a small strip connects the draft to its sources; reply/note context is explicit. | Put an evidence affordance beside the draft and open its detail without replacing text. Reduce source detail to what NEXUS actually exposes. Use a readable text action for confirmation rather than relying on the pictured icon-only send control. |
| [Linear Triage](https://linear.app/docs/triage) · [image](https://webassets.linear.app/images/ornj730p/production/30183e73c9ef009bb8cb14adbe97d9f34a5b9a69-2352x1632.png) | Repeated list rows; title is strongest; ID, source, and age are quieter and aligned. The published image is dark-themed. | Make summaries the scan target in the queue and retain source/context metadata below. Transfer row hierarchy into NEXUS's light theme; do not inherit the dark marketing presentation. |
| [Sentry Issue Details redesign, Feb 2025](https://sentry.io/changelog/new-issue-details-ui-now-available/) · [annotated image](https://cslswue7zohm4cat.public.blob.vercel-storage.com/us_okE0-diagram.png) | Header, workflow actions, event inspection, and activity occupy distinct regions. Technical rows expand; issue counts and event detail have different levels. | Separate decision, evidence, and operator activity. Put technical expansion behind disclosure. The dense stack trace and telemetry chart are useful engineering references, not the default support view. |
| [Plain Sidekick](https://www.plain.com/sidekick) · [image](https://framerusercontent.com/images/nbReZmNbiLidJuryE9rKovQI7HI.png) | A promotional composition shows contextual assistance attached to a thread and an input that retains a ticket reference. | Keep assistance scoped to the selected ticket. A full assistant chat, floating suggestion panel, and autonomous tools are not required for NEXUS's existing structured brief. |

Intercom's source-verification and editable-composer flow and incident.io's chronology/activity distinction were researched through their official written material. They are not recorded here as visually tested authenticated applications. Intercom's public article loaded through text retrieval; browser navigation timed out and its screenshot host could not be resolved during image retrieval.

## Local interface audit

Inspected the running React frontend at `http://localhost:5173/`, with `/health` reporting demo mode. The initial 1440×900 browser screenshot showed:

- A 56px header, 320px queue, flexible center, and approximately 288px permanent analytics sidebar.
- A session-empty queue beside 30 persisted incidents and a 75% average in analytics. This reveals differing data scopes; it is not proof of lost records.
- Three equally styled scenario buttons in the global header, with demo identity shown separately as a small badge.
- Plenty of central room in the empty state, while the sidebar truncates the service name and gives category colors considerable emphasis.

Source inspection complements the browser evidence: `TechnicalBrief.jsx` places a large confidence value, diagnosis metadata, and recommendation above the customer draft; `TicketQueue.jsx` emphasizes ID/confidence over the customer's issue. These are observations of current code, distinct from the empty-state screenshot. The [contract audit](backend-boundaries.md) documents behavioral implications separately.

The redesign should allocate width to the draft, put a customer issue summary ahead of machine labels, move aggregate reporting into an optional destination, and collect sample triggers within a distinct demo area. Preserve the useful foundation: a persistent queue, restrained light palette, an editable response, and technical disclosure.

## Decisions distilled from the research

1. **Workspace shape:** support inbox composition from Intercom/Pylon, with the response in the largest working area.
2. **Visual hierarchy:** Plain's message emphasis and Linear's repeated row structure, adapted to the current light NEXUS identity.
3. **Evidence:** source inspection from Intercom/Pylon plus Sentry's separation of summary and technical detail.
4. **State:** Plain/Linear's explicit work stages, narrowed to the states NEXUS can support.
5. **Chronology:** incident.io's separation of curated explanation and activity informs separate evidence and action histories.

These are design inferences from the linked sources and this project's operator needs. They are not comparative usability findings. The exact spacing, colors, type scale, breakpoints, and default group order in this skill are recommendations for NEXUS, not copied competitor specifications.
