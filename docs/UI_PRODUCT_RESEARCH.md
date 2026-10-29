# NEXUS UI product research

Research date: **28 October 2026**. Purpose: inform a reusable project UI skill and the next interface rebuild.

The resulting [NEXUS UI skill](../.agents/skills/nexus-ui/SKILL.md) turns this research into visual rules, interaction flows, and implementation checks. Its [visual inspection record](../.agents/skills/nexus-ui/references/visual-research.md) links the official images actually inspected and records the current dashboard audit. Invoke the skill with `$nexus-ui` for subsequent UI work.

## Product lens and method

NEXUS is a support operator's escalation workspace. A ticket arrives from Intercom; the application correlates Sentry, Slack, deployment, and Linear signals; a `TechnicalBrief` supplies a diagnosis, customer draft, engineering summary, and recommended action. The settled direction is **queue → ticket → review → edit → approve → dispatch**, with the customer response prominent, technical detail available on demand, and demo work separated from live work. These requirements come from [ui-decisions.md](../ui-decisions.md) and [models/brief.py](../models/brief.py).

The research uses first-party product documentation, help articles, and dated release notes. **Documented** below describes what those sources say; **NEXUS application** is a design recommendation inferred from the evidence and this project's requirements. Public documentation and product images do not establish how a logged-in account behaves. No authenticated competitor workflow was tested. Screenshots in older documentation may predate the current product; use them for spatial and interaction patterns rather than exact current styling. The accompanying visual inspection should establish appearance separately.

The comparison set deliberately spans three layers:

| Layer | Products | Question they help answer |
| --- | --- | --- |
| Support work | Intercom, Plain, Pylon | How do people move through a queue, read context, and send a considered reply? |
| Engineering handoff | Linear | How does a report become explicit, actionable work without losing its source? |
| Investigation and response | Sentry, incident.io | How do evidence, impact, chronology, and action remain legible under pressure? |

## 1. Intercom: a working conversation with inspectable assistance

**Documented.** Intercom distinguishes conversation work from its table layout: rows expose configurable fields and can open a conversation preview on the right. The table supports sorting and bulk actions; Command-K exposes actions and shortcuts. This gives different surfaces to operators reading a conversation and managers scanning many conversations. [The Inbox explained](https://www.intercom.com/help/en/articles/6258745-the-inbox-explained)

Copilot is accessible from a conversation's right sidebar. Its answers carry sources; a source can be previewed in the sidebar. The operator inserts an answer into the composer and can edit it before sending. Answers drawing on internal sources are marked, with an additional warning before insertion. The sidebar can be resized or hidden. [How to use Copilot](https://www.intercom.com/help/en/articles/8587194-how-to-use-copilot)

**Reconstructed documented flow:** select conversation → inspect assistance and its sources → insert draft → edit in composer → send.

**NEXUS application.** Keep the customer response and its editing surface central. Put engineering evidence in a contextual inspector or expandable section that preserves the ticket and draft. Make the boundary between internal diagnosis and customer-facing text explicit. A link to an evidence source should help validate a claim, not merely decorate the page with provider logos.

**Boundary.** Do not reproduce Intercom's entire channel, assignment, macro, and CRM system. NEXUS already receives Intercom tickets; its advantage is correlated technical evidence and a reviewable next action. Queue analytics belong in a secondary view, not a permanent competing column beside every draft.

## 2. Plain: a calm support queue with actionable states

**Documented.** Plain's queue status model distinguishes first response, next response, active investigation, waiting for a customer, and work paused for later. Its release note places status changes near the composer and describes synchronizing reply-driven status changes between Slack and Plain. [New support queue statuses](https://www.plain.com/changelog/new-support-queue-statuses-in-plain)

Plain's January 2026 thread redesign gives customer and agent messages more emphasis while reducing the prominence of status, label, and priority events. The same update describes linked internal tasks and saved filters, separating follow-through from the conversation itself. [January product update](https://www.plain.com/blog/january-product-update)

Sidekick's public FAQ says it may draft customer replies, but a teammate must review and send them. A separate workflow announcement describes investigations beginning before an operator opens a thread; its example checks Sentry and Linear and posts the findings as a note. [Sidekick](https://www.plain.com/sidekick), [Sidekick in Workflows](https://www.plain.com/changelog/sidekick-in-workflows)

**Reconstructed documented flow:** thread arrives → automated investigation prepares context → operator opens thread → reads relevant messages and findings → reviews draft → sends → explicit next state.

**NEXUS application.** Use human work states such as “Analyzing,” “Ready for review,” and “Needs attention.” Describe who or what is awaited. Visually quiet processing logs once a useful draft exists. Preserve the operator's draft while background evidence changes. Put a completed investigation into the review queue rather than implying the customer problem has been solved.

**Boundary.** Plain's workflow engine, scheduled jobs, tasks, and broad agent tooling are reference material, not a new NEXUS roadmap. Adopt the distinction between preparation and human communication; preserve this project's explicit approval requirement for all dispatch actions.

## 3. Pylon: the queue and open issue remain together

**Documented.** Current Pylon Views documentation includes an Inbox layout with the issue list beside the open issue. Its view system also supports List and Kanban layouts, grouping, sorting, filters, requester/message previews, and separate Drafts and Scheduled areas. Presence indicators help reveal simultaneous viewing. This page was opened directly because the search index still described an older, narrower layout set. [Views](https://docs.usepylon.com/pylon-docs/support-workflows/issues/views)

Pylon's editor Copilot generates an editable response and exposes its sources. A separate sidebar assistant supports troubleshooting with citations and a summary for handoffs. Related issues and documentation can also be suggested. [Copilot](https://docs.usepylon.com/pylon-docs/support-workflows/issues/copilot)

The product's orientation guide treats Issues and Analytics as separate areas. Within an issue, the right sidebar holds metadata and integration context, while the editor distinguishes replies from internal notes. [Platform orientation](https://support.usepylon.com/articles/4220063775-platform-orientation-pylon-101)

**Reconstructed documented flow:** choose filtered view → open issue alongside list → inspect contextual details or assistant → prepare reply/internal note → act and continue through queue.

**NEXUS application.** Preserve a selected row, queue position, filters, and draft while reviewing evidence. Use a compact list for the default support workflow. A narrow context panel may show severity, service, affected users, and an existing Linear issue; detailed causal evidence can expand when needed. Reply and internal escalation previews must have different audience labels.

**Boundary.** Avoid importing configurable boards, account health, custom-field builders, collaboration avatars, or scheduled messaging without supporting data and an explicit product need. Start with this project's status/severity/recency ordering; every queue control must perform a real function.

## 4. Linear: triage is a decision before work begins

**Documented.** Linear's Triage is a team inbox for incoming issues from integrations and other teams. An operator reviews and chooses an explicit outcome: accept, decline, merge as duplicate, or snooze. Accepting moves the issue into the team's workflow; asking for more information can keep it in triage. [Triage](https://linear.app/docs/triage)

Customer Requests link feedback to issues or projects and retain a reference to the originating support conversation. Customer pages aggregate related work. [Customer Requests](https://linear.app/docs/customer-requests)

Linear's own CX account describes a handoff from Intercom/Slack into engineering triage, followed by assignment, implementation, and a notification that prompts CX to contact the customer again. The human overseeing triage makes the final routing decision after automation. [How Linear's CX team works](https://linear.app/now/cx-in-linear)

**Reconstructed documented flow:** customer report → triage with original context → disposition/ownership → engineering work → completion signal → customer follow-up.

**NEXUS application.** Treat “analysis completed,” “reply sent,” “escalated,” and “resolved” as different facts. Show the next decision plainly. Keep an existing Linear issue ID near the diagnosis and escalation preview, with a link only when its destination is known. Retain enough customer context for an engineer to understand why the escalation matters.

**Boundary.** NEXUS's current brief exposes an optional Linear ID, not a full issue-management API. Do not offer “Create issue,” ownership changes, duplicate merging, or issue status synchronization as working features without implementing those contracts. Engineering triage density is useful for evidence; it should not displace the customer reply as the main support task.

## 5. Sentry: impact and evidence have different visual jobs

**Documented.** Sentry's Issue Details documentation separates a high-level header with impact and workflow actions from event-specific material such as stack traces and breadcrumbs. Time/environment filters affect event counts, while header totals represent issue lifetime. The sidebar carries metadata and related work. Its description of suspect commits uses potential causation rather than proof. The page was verified from its directly retrieved HTML after the search tool rejected its Markdown response. [Issue Details](https://docs.sentry.io/product/issues/issue-details/)

Sentry's February 2025 redesign announcement explicitly names information hierarchy and progressive disclosure: workflow actions are grouped, sections collapse, and tags, breadcrumbs, and activity can expand into drawers. It includes an annotated page diagram. [Issue Details redesign](https://sentry.io/changelog/new-issue-details-ui-now-available/)

**Reconstructed documented flow:** assess issue/impact → inspect a relevant event → examine supporting context → decide workflow action.

**NEXUS application.** Present severity and affected service as scannable metadata, then let the operator open the supporting record. Distinguish source observations from generated interpretation. Use “Possible deployment link” unless the evidence supports stronger wording. Display a confidence value as a model assessment with supporting/absent signals; a percentage is not proof. Differentiate “no match,” “source unavailable,” “not checked,” and “finding present” whenever the data contract supports those states.

**Boundary.** Sentry is an engineer's debugging tool. Avoid reproducing raw stack traces, event graphs, and dense telemetry in NEXUS's default response view. Do not invent a time series from a single `affected_users` count or turn free-text `causal_chain` entries into source-backed events without provenance.

## 6. incident.io: chronology, current attention, and follow-through

**Documented.** incident.io's September 2025 homepage redesign foregrounds incidents the user leads or participates in, alongside upcoming responsibilities. Team pages collect related operational resources; the homepage timeline can collapse. The stated purpose is to reveal what needs action next. [Teams and homepage redesign](https://incident.io/changelog/new-and-improved-teams-experience)

Its September 2026 update distinguishes an incident's curated timeline from its full activity log. It also describes separate Response and On-Call overview pages for aggregate information. [Alert-source and platform update](https://incident.io/changelog/easier-alert-source-set-up)

The incident lifecycle guide distinguishes mitigating immediate impact, resolving the underlying problem, and closing with remaining follow-ups scheduled into ordinary work. It recommends revisiting the incident timeline to recover context. [The lifecycle of an incident](https://incident.io/guide/response/the-lifecycle-of-an-incident)

**Reconstructed documented flow:** establish incident → assess evidence and impact → mitigate → resolve or hand off remaining work → close.

**NEXUS application.** Keep two chronologies separate: the evidence narrative explaining the customer problem, and activity describing what NEXUS or an operator did. Escalating to Slack is a handoff event, not evidence that the problem is resolved. A summary of pending attention is more useful in the operator's starting view than a grid of unrelated counts.

**Boundary.** Do not import paging schedules, incident command roles, postmortems, status pages, or a service catalog into the support review workspace. NEXUS should communicate the dispatch destination and outcome without claiming to manage the full incident lifecycle.

## Cross-product conclusions for the skill

These are **NEXUS recommendations**, not claims that every compared product behaves identically.

| UI decision | Rationale and evidence | Rebuild consequence |
| --- | --- | --- |
| Open on an actionable queue | Intercom, Plain, and Pylon organize daily work around conversations/issues; Linear gives intake its own decision stage. | Put queue selection and the next ticket decision ahead of global analytics. |
| Keep one ticket's reply central | Intercom's composer handoff, Plain's conversation emphasis, and Pylon's editor/sidebar split. | Customer context, editable draft, and destination-aware action are the dominant surface. |
| Inspect evidence without losing the draft | Intercom source previews and Sentry disclosure patterns preserve context. | Use a panel/tab/expander with stable selection and draft state; do not navigate away unnecessarily. |
| Separate AI preparation from operator dispatch | Intercom's editable composer flow and Plain's explicit customer-send boundary align with `ui-decisions.md`. | Show draft/review/dispatch states and action-specific approval. Approval applies to the exact current draft and destination. |
| Use status language that describes work | Plain differentiates waiting/investigating; Linear distinguishes intake from accepted work. | “Ready for review” must not render as “Resolved.” Keep severity independent from lifecycle. |
| Preserve evidence provenance | Intercom/Pylon citations, Linear source links, and Sentry event detail give context a traceable origin. | Show provider, record/time when supplied, and the actual source link; represent missing provenance honestly. |
| Separate evidence from action history | incident.io distinguishes curated chronology from complete activity; Sentry separates event data and workflow activity. | A deployment/error sequence belongs in evidence; analysis/reply/escalation events belong in activity. |
| Keep analytics available but secondary | Pylon separates Analytics; Intercom offers a scan-focused table; incident.io has overview surfaces. | Use a dedicated analytics destination or optional panel. Only show real, defined measures. |

### Fit to the three existing demonstration narratives

- **Checkout bug:** foreground the customer draft; make the proposed deployment/error/discussion relationship inspectable, and include a linked issue only when supplied. The current fallback brief has no Linear issue ID and untimed narrative entries; preserve those limits. The operator should inspect the suspected connection without reading pipeline machinery first.
- **Login / no matching technical evidence:** make absent evidence explicit. Avoid presenting lack of matches as proof the customer caused the problem. Keep follow-up wording respectful, and distinguish the stored classification from the confidence an operator should place in it.
- **External payment dependency:** surface customer impact and the dependency hypothesis, then provide a separate engineering handoff preview. Do not infer an outage, affected-customer total, or recovery time beyond the actual brief and source records.

### Behaviors worth validating during implementation

1. An operator can select a ticket, understand the proposed response, inspect one supporting source, return to the same draft, edit it, review the exact destination/content, and dispatch with a truthful result.
2. Incoming analysis events never overwrite edits or move focus away from the selected ticket.
3. A processing failure, missing source, failed dispatch, empty queue, and disconnected stream have distinct, useful states.
4. Desktop queue/detail composition collapses to a readable small-screen flow while retaining a clear return to queue.
5. Demo context remains visible in the queue, detail, and dispatch preview. Neither a mode badge nor sample content should imply a real delivery occurred.

## Source register

All sources were consulted on 28 October 2026. “Help/docs” describes official behavior; “release” describes the change at publication, which may not be the latest appearance. Image-bearing pages are candidates for visual inspection, not a claim that all their pixels were inspected in this text research.

| ID | Source | Type / useful evidence |
| --- | --- | --- |
| I1 | [Intercom Inbox](https://www.intercom.com/help/en/articles/6258745-the-inbox-explained) | Help; queue/table, preview, shortcuts; dated 17 Sep 2026. |
| I2 | [Intercom Copilot](https://www.intercom.com/help/en/articles/8587194-how-to-use-copilot) | Help; sources, internal/source distinction, composer handoff. |
| P1 | [Plain statuses](https://www.plain.com/changelog/new-support-queue-statuses-in-plain) | Release, 5 Sep 2024; work states and composer-adjacent actions; images. |
| P2 | [Plain thread redesign](https://www.plain.com/blog/january-product-update) | Release summary, 28 Jan 2026; message/event hierarchy; images. |
| P3 | [Plain Sidekick](https://www.plain.com/sidekick) | Product/FAQ; explicit review and send boundary. |
| P4 | [Plain automated investigations](https://www.plain.com/changelog/sidekick-in-workflows) | Release, 6 Jul 2026; evidence gathered before operator review. |
| Y1 | [Pylon Views](https://docs.usepylon.com/pylon-docs/support-workflows/issues/views) | Docs; current Inbox/List/Kanban patterns; images. |
| Y2 | [Pylon Copilot](https://docs.usepylon.com/pylon-docs/support-workflows/issues/copilot) | Docs; draft/source/sidebar distinction; images and animations. |
| Y3 | [Pylon orientation](https://support.usepylon.com/articles/4220063775-platform-orientation-pylon-101) | Help; product areas and issue context. |
| L1 | [Linear Triage](https://linear.app/docs/triage) | Docs; explicit intake outcomes; full product screenshot. |
| L2 | [Linear Customer Requests](https://linear.app/docs/customer-requests) | Docs; links between original feedback and engineering work. |
| L3 | [Linear's CX workflow](https://linear.app/now/cx-in-linear) | First-party practice, 6 Nov 2025; human handoff and customer follow-up. |
| S1 | [Sentry Issue Details](https://docs.sentry.io/product/issues/issue-details/) | Docs; directly retrieved HTML verified after web extraction rejected Markdown MIME. |
| S2 | [Sentry redesign](https://sentry.io/changelog/new-issue-details-ui-now-available/) | Release, 6 Feb 2025; hierarchy/disclosure rationale; annotated image. |
| N1 | [incident.io homepage](https://incident.io/changelog/new-and-improved-teams-experience) | Release, 10 Sep 2025; attention-first homepage; images. |
| N2 | [incident.io platform update](https://incident.io/changelog/easier-alert-source-set-up) | Release, 8 Sep 2026; timeline versus activity log; separate overviews. |
| N3 | [incident.io lifecycle](https://incident.io/guide/response/the-lifecycle-of-an-incident) | First-party practice; mitigation/resolution/closure distinction. |

## Research limits

This study identifies patterns that fit NEXUS; it does not establish competitor usability scores, conversion or time-saving claims, user satisfaction, accessibility compliance, or exact typography/color tokens. Those would require separate evaluation. The reusable skill should turn the selected patterns into NEXUS-specific visual rules and acceptance criteria, then verify them against the actual frontend and backend contracts. A good-looking reference cannot authorize a feature the application cannot perform.
