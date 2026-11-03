import {
  draftKey,
  evidenceSources,
  mergeTickets,
  reviewState,
} from "./workspace";

it("reconciles history and repeated completion events without double counting", () => {
  const brief = { severity: "high" };
  const history = [{ ticket_id: "a", brief, actions: [{ action: "reply" }] }];
  const event = { ticket_id: "a", event: "completed", brief };
  const tickets = mergeTickets(history, [
    event,
    event,
    { event: "sources_checked", ticket_id: "a", source_count: 2 },
  ]);
  expect(tickets).toHaveLength(1);
  expect(reviewState(tickets[0])).toBe("replied");
  expect(tickets[0].coverage.source_count).toBe(2);
});

it("does not overwrite a persisted result with an older failed attempt", () => {
  const tickets = mergeTickets(
    [{ ticket_id: "a", brief: {}, review_resolved_at: "2026-10-28" }],
    [
      { ticket_id: "a", event: "error", message: "Earlier attempt failed" },
      { ticket_id: "all", event: "sync_required" },
    ],
  );
  expect(tickets).toHaveLength(1);
  expect(reviewState(tickets[0])).toBe("resolved");
});

it("keeps new ticket metadata and failure available before persistence", () => {
  const [ticket] = mergeTickets(
    [],
    [
      {
        ticket_id: "b",
        event: "started",
        environment: "demo",
        message_body: "Help",
        customer_email: "b@example.com",
      },
      { ticket_id: "b", event: "error", message: "Timeout" },
    ],
  );
  expect(ticket.environment).toBe("demo");
  expect(ticket.message_body).toBe("Help");
  expect(reviewState(ticket)).toBe("attention");
});

it("separates environment draft keys and normalizes duplicate source names", () => {
  expect(draftKey("demo", { ticket_id: "a" })).not.toBe(
    draftKey("live", { ticket_id: "a" }),
  );
  expect(
    evidenceSources({ signals_used: ["deploy", "github", "sentry"] }),
  ).toEqual(["GitHub", "Sentry"]);
});
