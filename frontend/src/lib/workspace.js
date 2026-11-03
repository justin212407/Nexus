export const ROOT_CAUSES = {
  known_bug: "Known bug",
  service_degradation: "Service degradation",
  user_error: "User-side issue (suggested)",
  external_dependency: "External dependency",
  unknown: "Undetermined",
};
export const SOURCES = {
  sentry: "Sentry",
  slack: "Slack",
  deploy: "GitHub",
  github: "GitHub",
  linear: "Linear",
};
export const SEVERITIES = { critical: 0, high: 1, medium: 2, low: 3 };
export const ACTION_LABELS = {
  reply: "Reply simulated",
  escalate: "Escalation simulated",
  resolve: "Resolved in NEXUS",
};

export function mergeTickets(history, events) {
  const map = new Map(
    history.map((ticket) => [
      ticket.ticket_id,
      { ...ticket, status: ticket.brief ? "ready" : "analyzing" },
    ]),
  );
  for (const event of events) {
    if (!event.ticket_id || event.event === "sync_required") continue;
    const ticket = map.get(event.ticket_id) || {
      ticket_id: event.ticket_id,
      actions: [],
      status: "analyzing",
    };
    if (event.event === "started") {
      for (const key of ["customer_email", "message_body", "environment"]) {
        if (event[key] != null) ticket[key] = event[key];
      }
      ticket.received_at ||= event.timestamp;
    }
    if (event.event === "completed" && event.brief) {
      ticket.brief = event.brief;
      ticket.status = "ready";
      delete ticket.error;
    }
    if (event.event === "error" && !ticket.brief) {
      ticket.status = "failed";
      ticket.error = event.message;
    }
    if (event.event === "sources_checked") ticket.coverage = event;
    map.set(event.ticket_id, ticket);
  }
  return [...map.values()];
}
export function reviewState(ticket) {
  if (ticket.status === "failed") return "attention";
  if (ticket.review_resolved_at) return "resolved";
  if (!ticket.brief) return "analyzing";
  if (ticket.actions?.some((a) => a.action === "escalate")) return "escalated";
  if (ticket.actions?.some((a) => a.action === "reply")) return "replied";
  return "review";
}
export const STATE_LABELS = {
  review: "Needs review",
  analyzing: "Analyzing",
  attention: "Needs attention",
  replied: "Reply simulated",
  escalated: "Escalation simulated",
  resolved: "Resolved",
};
export function sortTickets(tickets) {
  const rank = {
    attention: 0,
    review: 1,
    escalated: 2,
    replied: 3,
    analyzing: 4,
    resolved: 5,
  };
  return [...tickets].sort(
    (a, b) =>
      rank[reviewState(a)] - rank[reviewState(b)] ||
      (SEVERITIES[a.brief?.severity] ?? 4) -
        (SEVERITIES[b.brief?.severity] ?? 4) ||
      timestamp(b.received_at || b.created_at) -
        timestamp(a.received_at || a.created_at),
  );
}
export function timestamp(value) {
  if (!value) return 0;
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value)
    ? value
    : value.replace(" ", "T") + "Z";
  return new Date(normalized).getTime() || 0;
}
export function relativeTime(value) {
  const stamp = timestamp(value);
  if (!stamp) return "Time unavailable";
  const mins = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}
export function ticketTitle(ticket) {
  return (
    ticket.message_body?.split("\n")[0] ||
    ticket.brief?.summary ||
    `Ticket ${ticket.ticket_id}`
  );
}
export function ticketCode(ticket) {
  return ticket.ticket_id.startsWith("demo_")
    ? `NXS-${ticket.ticket_id.split("_").pop()}`
    : ticket.ticket_id;
}
export function customerName(email) {
  return email ? email.split("@")[0] : "Customer unavailable";
}
export function initials(email) {
  return customerName(email)
    .split(/[._ -]/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
export function evidenceSources(brief) {
  return [...new Set((brief?.signals_used || []).map((s) => SOURCES[s] || s))];
}
export function escalationText(ticket) {
  const b = ticket.brief;
  return `${ticketCode(ticket)} · ${ticketTitle(ticket)}\n\nCustomer: ${ticket.customer_email || "Unavailable"}\nSeverity: ${b.severity}\nService: ${b.affected_service}\n\n${b.engineer_summary}\n\nRecommended next step\n${b.recommended_action}\n\nAnalysis narrative\n${(b.causal_chain || []).map((s) => "• " + s).join("\n")}${b.linear_issue_id ? "\n\nRelated issue: " + b.linear_issue_id : ""}`;
}
export function draftKey(mode, ticket) {
  return `${mode}:${ticket.ticket_id}`;
}
export async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : `Request failed (${res.status}). Please try again.`,
      );
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("The request timed out. Its outcome is not confirmed.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
