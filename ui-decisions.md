# UI Redesign Decisions

This document records the agreed design direction for replacing/revamping the current NEXUS dashboard.

## Audience

- Primary users are **support/escalation staff**.
- Secondary users are engineers and demo audiences.

## Primary goal

- Improve the **end-to-end ticket-review workflow** first.
- Add **visual polish** and focused data views second.

## UI strategy

- Keep and improve the **existing React + Vite frontend**.
- Do not migrate away from it; the current FastAPI/SSE backend already supports a clean frontend/backend split.

## Core workflow

The interface follows this flow:

```
Queue → Select ticket → Review response + technical details → Edit if needed → Approve → Dispatch
```

## Dispatch actions

After reviewing a ticket, staff can:

- **Send reply** to the customer.
- **Escalate to Slack**.
- **Mark ticket as resolved**.

Each action requires explicit approval before anything is sent.

## Response editing

- Staff can **edit the suggested customer-facing response** before dispatch.
- The edited response must still be approved before sending.

## Information hierarchy

- Show the **customer-ready response** prominently.
- Keep **technical diagnosis and evidence** easy to inspect, but do not make it the default view.

## Queue prioritization

Tickets are sorted and grouped by:

1. **Status**
2. **Severity**
3. **Recency**

## Demo/live separation

- Keep **demo scenarios** available in the UI.
- Visually and functionally separate demo work from live tickets.

## Layout

- **Desktop-first** layout.
- Responsive fallback for smaller screens.

## Visual style

- **Clean support workspace**.
- Restrained technical detail.
- Clear live/demo separation.

## Open questions

None. The design direction is settled and implementation is in progress.
