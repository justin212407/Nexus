import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import TechnicalBrief from "./TechnicalBrief";

const ticket = {
  ticket_id: "demo_checkout_42",
  customer_email: "maya@example.com",
  environment: "demo",
  message_body: "Checkout fails\nPlease help.",
  actions: [],
  brief: {
    severity: "high",
    root_cause: "known_bug",
    affected_service: "checkout",
    summary: "Checkout issue",
    draft_customer_response: "Original draft",
    signals_used: ["sentry"],
    causal_chain: [],
  },
};
const props = {
  ticket,
  response: "My edited customer reply",
  onResponse: vi.fn(),
  persistent: true,
  config: {
    mode: "demo",
    simulated_actions: true,
    slack_channel: "#engineering",
  },
  onAction: vi.fn().mockResolvedValue(),
  position: 1,
  total: 1,
};
beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ status: "simulated" }),
      }),
  ),
);
afterEach(() => vi.unstubAllGlobals());

it("previews exact text and destination, and cancellation makes no request", () => {
  render(<TechnicalBrief {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Review reply" }));
  const modal = screen.getByRole("dialog");
  expect(within(modal).getByText(props.response)).toBeInTheDocument();
  expect(within(modal).getByText("maya@example.com")).toBeInTheDocument();
  fireEvent.click(within(modal).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it("submits the edited payload once even with duplicate confirmation clicks", async () => {
  render(<TechnicalBrief {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Review reply" }));
  const confirm = screen.getByRole("button", { name: "Simulate reply" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe("/tickets/demo_checkout_42/reply");
  expect(JSON.parse(options.body)).toMatchObject({
    ticket_id: ticket.ticket_id,
    action: "reply",
    content: props.response,
    destination: "maya@example.com",
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "No external message was sent",
  );
});

it("invalidates approval when its payload or destination changes", () => {
  const { rerender } = render(<TechnicalBrief {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Review reply" }));
  rerender(<TechnicalBrief {...props} response="Changed again" />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Escalate" }));
  rerender(
    <TechnicalBrief
      {...props}
      response="Changed again"
      config={{ ...props.config, slack_channel: "#another-channel" }}
    />,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it("retains the approval request ID for an explicit retry after an uncertain failure", async () => {
  fetch.mockRejectedValueOnce(new Error("Connection interrupted"));
  render(<TechnicalBrief {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Review reply" }));
  fireEvent.click(screen.getByRole("button", { name: "Simulate reply" }));
  await screen.findByRole("alert");
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Simulate reply" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
});

it("keeps live and imported tickets unavailable for simulated actions", () => {
  render(
    <TechnicalBrief {...props} ticket={{ ...ticket, environment: null }} />,
  );
  expect(screen.getByRole("button", { name: "Review reply" })).toBeDisabled();
});
