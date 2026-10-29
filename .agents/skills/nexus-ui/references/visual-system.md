# Visual system

These are recommended NEXUS defaults. Preserve the operator flow when adapting them to a future brand direction. The reference research establishes interaction principles, not exact pixel values.

## Shell and information hierarchy

The application opens on the queue. A 56px workspace header carries the product name, current environment, connection status, and a few real destinations. Queue and Insights are sufficient when both work; put demo scenarios under a clearly labeled demo control. Avoid adding empty navigation destinations to fill a rail.

At desktop widths, use a 300–336px queue and a flexible detail workspace. The main reading column is 560–760px where space permits. At widths of 1440px and above, an explicitly opened evidence inspector may occupy 320–360px if at least 560px remains for the editor. Otherwise show evidence in a drawer or an in-place tab. The inspector is closed by default; summary metadata can remain inline.

```text
┌ NEXUS    Queue  Insights                         Demo workspace · Connected ┐
├──────────────────────┬──────────────────────────────────────────────────────┤
│ Queue                │ Ticket identity · customer · age       Evidence     │
│ Search / filters     │ Short diagnosis · severity · affected service        │
│                      ├──────────────────────────────────────────────────────┤
│ Ready for review     │ Customer context, when available                     │
│   selected ticket    │                                                      │
│   next ticket        │ Draft response                         AI-drafted    │
│                      │ [editable response, generous reading width]          │
│ Analyzing            │                                                      │
│   incoming ticket    │ Review reply     Escalate…     Mark resolved…        │
│                      │ Explicit result / activity                           │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

“Review reply” in this sketch represents the target customer-reply flow. Choose the actual label using the contract rules in [backend-boundaries.md](backend-boundaries.md).

Detail order: identity → concise context → response editor → action outcome. Keep the diagnosis strip to a few lines; long recommendations belong beside the relevant action or in evidence. A standalone 90% confidence hero must not push the draft below the first viewport.

## Tokens

Use semantic CSS variables or equivalent shared Tailwind tokens. Check actual text/background pairs after implementation, including hover, disabled, selected, and focused states.

| Role | Default | Use |
| --- | --- | --- |
| Canvas | `#F6F7F9` | Workspace background |
| Surface | `#FFFFFF` | Editor and detail plane |
| Subtle surface | `#F0F2F5` | Navigation/secondary regions |
| Text | `#182230` | Body, headings |
| Secondary text | `#526071` | Descriptive metadata |
| Muted text | `#626D7E` | Timestamps and tertiary labels |
| Divider | `#E2E6EC` | Noninteractive section boundaries |
| Control border | `#7B8798` | Necessary input/control outlines |
| Action | `#2459D3` | Primary action, links, focus indicator |
| Action hover | `#1B45A6` | Primary hover/pressed |
| Selected surface | `#EDF3FF` | Selected queue row; pair with indicator |
| Success ink / surface | `#166534` / `#F0FDF4` | Confirmed successful action |
| Warning ink / surface | `#92400E` / `#FFFBEB` | Incomplete evidence, attention |
| Error ink / surface | `#B42318` / `#FEF3F2` | Failed action, critical severity |
| Demo ink / surface | `#6941C6` / `#F4F3FF` | Environment identity |

Separate the palettes' jobs. High severity uses restrained amber; critical uses red; medium/low can be neutral with text labels. A blue selection does not mean low severity. “Live” is a neutral environment label, connection state is separate, and green is reserved for an evidenced positive result. Root-cause labels do not each need a different saturated color.

Typography: use the existing system sans stack. Body/editor 14–15px with 21–24px line height; queue title 14px/20px at 500–600; metadata 12–13px/18px; screen title 20px/28px at 600. Avoid all-caps paragraphs and 10px metadata. Use tabular numerals for comparable counts; monospace only for IDs, paths, and code. The response is upright prose, not an italic quotation.

Spacing scale: 4, 8, 12, 16, 24, 32px. Start with 16px queue padding and 24px detail padding. Use 6px control radii, 8px composer radii, and 10–12px overlay radii. Separate major planes with a border, and reserve shadows for floating menus/drawers. Motion is a short 120–180ms state transition; honor reduced motion and use a static processing label when animation is disabled.

## Component recipes

### Queue

Use full-width, 72–88px rows separated by a subtle rule. A row contains a short issue summary, customer identity when available, status, severity, and age. Put the ticket ID in secondary text. During processing, fall back to a shortened ID and “Analyzing”; do not invent a customer or request summary.

The selected row has a tinted fill and a persistent narrow accent or other non-color marker. Hover and keyboard focus remain distinguishable. Keep long summaries to two lines with the full text in detail. Group by workflow status, then sort severity and recency within groups. Counts reflect the displayed dataset/filter and its scope, not an implied global total.

Search and filters belong above the list. Prefer status and severity controls over a general-purpose query builder. Show active filters and a reset action. Preserve the selected ticket if an update moves it outside the current filter; explain its new state instead of silently replacing it.

### Response editor

Make the composer the strongest bounded surface in the detail view. Its header names the audience: “Customer reply” or “Internal note.” Use a subdued “AI-drafted” label, a plain textarea or existing editor, and a stable action footer. A source count can open evidence; compute it from actual supplied sources.

Show the original customer message only when available. An AI `summary` is labeled “Analysis summary”; it cannot masquerade as a customer quotation. Show draft saving status only at the persistence level implemented: “Unsaved,” “Kept in this session,” or a confirmed server save. A local state update does not justify “Saved.”

### Evidence

Use a compact disclosure with three conceptual groups: diagnosis, supporting sources, and analysis narrative. Show provider + finding + timestamp/link when supplied. Use a 16px provider icon with a text label, not a decorative integration logo grid.

A timeline requires actual ordered times. Untimed `causal_chain` strings render as a list labeled “Analysis narrative.” An inferred correlation is labeled as such. A separate Activity area can show processing and operator actions when recorded; keep those apart from source observations.

Confidence is secondary: “Model confidence: 88%” with a brief explanation that it is the generated assessment, not measured accuracy. Prefer evidence visibility to a gauge. Unknown or invalid values render unavailable, and numeric zero remains zero.

### Approval and results

Use a dialog or inline preview with a clear ticket heading, audience/destination, exact content/effect, and an action-specific confirmation: “Post internal note,” “Send customer reply,” “Escalate to Slack,” or “Mark resolved.” Include a normal Cancel action. Keep secondary actions visually secondary; use destructive styling only for destructive effects.

After an action, keep its result in the ticket context. Toasts can supplement a visible status but cannot be the only record. A failed request keeps the draft and the next recoverable action visible.

### Analytics

Use a secondary Insights surface only when requested or already implemented. Begin with real counts and labeled horizontal breakdowns. State dataset/time scope. Use the same category order and labels across charts, counts, and filters. Hide unsupported averages, trends, SLA measurements, response times, and resolution rates until backed by defined data.

## Responsive and accessible behavior

- At 1280px, keep queue + detail and use a drawer/tab for evidence. Prioritize editor width over a permanently visible third column.
- At 900–1279px, use a 272–300px queue where practical; the inspector overlays or replaces the detail subview. Test the actual longest draft.
- Below 900px, show queue and detail as separate views with “Back to queue.” Retain filter, selection, and scroll on return. At 390px, use 16px horizontal padding and stacked actions.
- Keep the action area accessible when the mobile keyboard opens. Avoid an immovable footer that covers the textarea, focus ring, or last line.
- Every icon-only control has an accessible name. Status includes text/icon as well as color. Use real controls and correct dialog focus handling; announce async results politely without reannouncing the entire queue.
- Target 4.5:1 normal text contrast, 3:1 large text and essential non-text controls, a clearly visible focus ring, and approximately 44px touch targets on mobile. Desktop compact buttons may be 32–36px high with usable spacing.
- Keyboard shortcuts are optional enhancements. Enable only implemented actions, document them, and suppress navigation shortcuts while typing. Enter in a text field must not accidentally dispatch.
