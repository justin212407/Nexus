import React from "react";
import Icon from "./Icon";
import {
  initials,
  customerName,
  relativeTime,
  reviewState,
  STATE_LABELS,
  ticketCode,
  ticketTitle,
} from "../lib/workspace";

export default function TicketQueue({
  tickets,
  selectedId,
  onSelect,
  search,
  onSearch,
  filter,
  onFilter,
  severity,
  onSeverity,
  scope,
  onScope,
  mode,
  total,
  loading,
  onDemo,
  onRefresh,
}) {
  const groups = [...new Set(tickets.map(reviewState))];
  return (
    <aside className="queue-panel" aria-label="Ticket queue">
      <div className="queue-heading">
        <div>
          <h1>
            Inbox <span className="count-badge">{total}</span>
          </h1>
          <p>A little clarity for every escalation.</p>
        </div>
        <button
          className="icon-button"
          onClick={onRefresh}
          aria-label="Refresh tickets"
        >
          <Icon name="refresh" size={16} />
        </button>
      </div>
      <div className="queue-controls">
        <label className="search-field">
          <Icon name="search" size={17} />
          <input
            aria-label="Search tickets"
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
          {search && (
            <button aria-label="Clear search" onClick={() => onSearch("")}>
              <Icon name="close" size={14} />
            </button>
          )}
        </label>
        <div className="queue-tabs" aria-label="Ticket status filter">
          {[
            ["open", "Open"],
            ["all", "All"],
            ["resolved", "Resolved"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => onFilter(key)}
              aria-pressed={filter === key}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <label className="select-wrap">
            <Icon name="filter" size={15} />
            <select
              aria-label="Filter severity"
              value={severity}
              onChange={(e) => onSeverity(e.target.value)}
            >
              <option value="all">All priorities</option>
              {["critical", "high", "medium", "low"].map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <select
            aria-label="Ticket environment"
            className="scope-select"
            value={scope}
            onChange={(e) => onScope(e.target.value)}
          >
            <option value="current">
              {mode === "demo"
                ? "Demo tickets"
                : mode === "live"
                  ? "Live tickets"
                  : "Workspace"}
            </option>
            <option value="legacy">Imported history</option>
          </select>
        </div>
      </div>
      <div className="queue-list">
        {loading && (
          <div className="queue-loading" aria-label="Loading tickets">
            {[1, 2, 3, 4].map((n) => (
              <div className="skeleton-row" key={n}>
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {!loading && !tickets.length && (
          <div className="queue-empty">
            <span className="empty-icon">
              <Icon name="inbox" size={24} />
            </span>
            <h3>
              {search || severity !== "all" || filter === "resolved"
                ? "No matching tickets"
                : "You’re all caught up"}
            </h3>
            <p>
              {search || severity !== "all" || filter === "resolved"
                ? "Try a different filter or search."
                : mode === "demo"
                  ? "Load sample tickets to explore the review workflow."
                  : "Incoming tickets will appear here."}
            </p>
            {search || severity !== "all" || filter === "resolved" ? (
              <button
                className="text-button"
                onClick={() => {
                  onSearch("");
                  onSeverity("all");
                  onFilter("open");
                }}
              >
                Clear filters
              </button>
            ) : (
              mode === "demo" &&
              scope !== "legacy" && (
                <button className="text-button" onClick={onDemo}>
                  Explore demo scenarios <Icon name="arrow" size={15} />
                </button>
              )
            )}
          </div>
        )}
        {groups.map((state) => (
          <div className="queue-group" key={state}>
            <div className="queue-group-label">
              <span>
                <i className={`status-dot ${state}`} />
                {STATE_LABELS[state]}
              </span>
              <span>
                {tickets.filter((t) => reviewState(t) === state).length}
              </span>
            </div>
            {tickets
              .filter((t) => reviewState(t) === state)
              .map((ticket) => (
                <button
                  key={ticket.ticket_id}
                  className={`ticket-row ${ticket.ticket_id === selectedId ? "selected" : ""}`}
                  onClick={() => onSelect(ticket.ticket_id)}
                  aria-current={
                    ticket.ticket_id === selectedId ? "true" : undefined
                  }
                >
                  <div className="ticket-row-top">
                    <span
                      className={`avatar avatar-small tone-${(ticket.customer_email || "").length % 4}`}
                    >
                      {initials(ticket.customer_email)}
                    </span>
                    <span className="ticket-customer">
                      {customerName(ticket.customer_email)}
                    </span>
                    <time>
                      {relativeTime(ticket.received_at || ticket.created_at)}
                    </time>
                  </div>
                  <span className="ticket-subject">{ticketTitle(ticket)}</span>
                  <div className="ticket-row-bottom">
                    <span className="ticket-code">{ticketCode(ticket)}</span>
                    <span
                      className={`severity-inline ${ticket.brief?.severity || ""}`}
                    >
                      <i />
                      {ticket.brief?.severity ||
                        (state === "attention"
                          ? "Analysis failed"
                          : "Analyzing")}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        ))}
      </div>
      <div className="queue-footer">
        <Icon name="shield" size={14} />
        <span>Every response starts with your review.</span>
      </div>
    </aside>
  );
}
