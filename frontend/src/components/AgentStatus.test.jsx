import React from "react";
import { render, screen } from "@testing-library/react";
import AgentStatus from "./AgentStatus";

it("shows an analysis failure without claiming progress or completion", () => {
  render(
    <AgentStatus
      ticketId="a"
      events={[
        { ticket_id: "a", event: "error", message: "Source query timed out" },
      ]}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Source query timed out");
  expect(screen.queryByText("Analysis in progress")).not.toBeInTheDocument();
});

it("keeps source coverage and failures scoped to the selected ticket", () => {
  render(
    <AgentStatus
      ticketId="a"
      events={[
        {
          ticket_id: "a",
          event: "sources_checked",
          source_count: 2,
          available_sources: ["sentry", "slack"],
          healthy: false,
        },
        { ticket_id: "b", event: "error", message: "Other ticket failed" },
      ]}
    />,
  );
  expect(
    screen.getByText("Sources checked: 2/4 available"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Investigation may be incomplete/),
  ).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("uses indeterminate progress rather than claiming fabricated stages", () => {
  render(
    <AgentStatus
      ticketId="a"
      events={[{ ticket_id: "a", event: "started" }]}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Analysis in progress");
  expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
});
