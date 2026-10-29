import React, { useCallback, useEffect, useMemo, useState } from "react";
import Icon, { Logo } from "./components/Icon";
import TicketQueue from "./components/TicketQueue";
import TechnicalBrief from "./components/TechnicalBrief";
import AgentStatus from "./components/AgentStatus";
import Insights from "./components/Insights";
import DemoLab from "./components/DemoLab";
import { useDrafts, useWorkspace } from "./hooks/useWorkspace";
import {
  draftKey,
  request,
  reviewState,
  sortTickets,
  ticketTitle,
} from "./lib/workspace";

function readView() {
  const value = window.location.hash.slice(1);
  return ["inbox", "insights", "demo"].includes(value) ? value : "inbox";
}
export default function App() {
  const workspace = useWorkspace();
  const {
    tickets,
    config,
    loading,
    error,
    refresh,
    connected,
    events,
    updatedAt,
  } = workspace;
  const { drafts, updateDraft, persistent } = useDrafts();
  const [view, setView] = useState(readView);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("open");
  const [severity, setSeverity] = useState("all");
  const [scope, setScope] = useState("current");
  const [mobileDetail, setMobileDetail] = useState(false);
  const [demoLoading, setDemoLoading] = useState(null);
  const [demoError, setDemoError] = useState(null);
  const mode = config?.mode;
  useEffect(() => {
    const handler = () => setView(readView());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const navigate = useCallback((next) => {
    window.location.hash = next;
    setView(next);
  }, []);
  const environmentTickets = useMemo(
    () =>
      tickets.filter((t) =>
        scope === "legacy" ? !t.environment : mode && t.environment === mode,
      ),
    [tickets, mode, scope],
  );
  const sorted = useMemo(
    () => sortTickets(environmentTickets),
    [environmentTickets],
  );
  const filtered = useMemo(
    () =>
      sorted.filter((t) => {
        const state = reviewState(t);
        if (filter === "open" && state === "resolved") return false;
        if (filter === "resolved" && state !== "resolved") return false;
        if (severity !== "all" && t.brief?.severity !== severity) return false;
        return (
          !search ||
          [
            t.customer_email,
            t.ticket_id,
            t.message_body,
            t.brief?.summary,
            t.brief?.affected_service,
          ].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
        );
      }),
    [sorted, filter, severity, search],
  );
  useEffect(() => {
    if (!selectedId && sorted.length) setSelectedId(sorted[0].ticket_id);
  }, [selectedId, sorted]);
  const selected = environmentTickets.find((t) => t.ticket_id === selectedId);
  const position = filtered.findIndex((t) => t.ticket_id === selectedId);
  const select = (id) => {
    setSelectedId(id);
    setMobileDetail(true);
  };
  const changeScope = (value) => {
    setScope(value);
    setSelectedId(null);
    setMobileDetail(false);
  };
  const currentTickets = tickets.filter((t) => t.environment === mode && mode);
  const pendingCount = currentTickets.filter((t) =>
    ["review", "attention"].includes(reviewState(t)),
  ).length;
  const loadDemo = async (scenario) => {
    setDemoLoading(scenario);
    setDemoError(null);
    try {
      const result = await request("/demo/samples", {
        method: "POST",
        body: JSON.stringify({ scenario }),
      });
      await refresh();
      setScope("current");
      setSearch("");
      setFilter("open");
      setSeverity("all");
      setSelectedId(result.ticket_ids[0] || null);
      setMobileDetail(true);
      navigate("inbox");
    } catch (err) {
      setDemoError(err.message);
    } finally {
      setDemoLoading(null);
    }
  };
  const draft = selected
    ? (drafts[draftKey(selected.environment || "legacy", selected)] ??
      selected.brief?.draft_customer_response ??
      "")
    : "";
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content").focus();
        }}
      >
        Skip to workspace
      </a>
      <header className="app-header">
        <a className="brand" href="#inbox" aria-label="NEXUS home">
          <Logo />
          <span>NEXUS</span>
        </a>
        <span className="header-divider" />
        <div className="workspace-name">Support workspace</div>
        <nav className="main-nav" aria-label="Main navigation">
          {[
            ["inbox", "inbox", "Inbox"],
            ["insights", "chart", "Insights"],
            ["demo", "flask", "Demo lab"],
          ].map(([id, icon, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon name={icon} size={17} />
              {label}
              {id === "inbox" && pendingCount > 0 && (
                <span>{pendingCount}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="header-status">
          <span
            className={`connection ${connected ? "connected" : ""}`}
            title={
              connected
                ? "Event stream connected"
                : "Waiting for the event stream; saved tickets remain available"
            }
          >
            <i />
            {connected ? "Connected" : "Reconnecting"}
          </span>
          <span
            className={`environment-tag ${mode === "demo" ? "demo" : "neutral"}`}
          >
            {mode === "demo" ? (
              <Icon name="flask" size={13} />
            ) : (
              <Icon name="shield" size={13} />
            )}{" "}
            {mode === "demo"
              ? "Demo workspace"
              : mode === "live"
                ? "Live workspace"
                : "Mode unavailable"}
          </span>
        </div>
      </header>
      {error && (
        <div className="workspace-alert" role="alert">
          <Icon name="warning" size={16} />
          <span>
            {error} {tickets.length ? "Showing the last loaded tickets." : ""}
          </span>
          <button onClick={refresh}>Try again</button>
        </div>
      )}
      <div className="app-content" id="main-content" tabIndex={-1}>
        {view === "inbox" && (
          <main
            className={`inbox-layout ${mobileDetail && selected ? "show-detail" : ""}`}
          >
            <TicketQueue
              tickets={filtered}
              selectedId={selectedId}
              onSelect={select}
              search={search}
              onSearch={setSearch}
              filter={filter}
              onFilter={setFilter}
              severity={severity}
              onSeverity={setSeverity}
              scope={scope}
              onScope={changeScope}
              mode={mode}
              total={environmentTickets.length}
              loading={loading}
              onDemo={() => navigate("demo")}
              onRefresh={refresh}
            />
            <div className="detail-container">
              {selected && position < 0 && (
                <div className="filtered-selection">
                  <Icon name="info" size={15} />
                  This ticket is outside the current filters.
                  <button
                    onClick={() => {
                      setFilter("all");
                      setSeverity("all");
                      setSearch("");
                    }}
                  >
                    Show in queue
                  </button>
                </div>
              )}
              {selected?.brief && selected.status !== "failed" ? (
                <TechnicalBrief
                  key={`${selected.environment}:${selected.ticket_id}`}
                  ticket={selected}
                  response={draft}
                  onResponse={(value) =>
                    updateDraft(
                      draftKey(selected.environment || "legacy", selected),
                      value,
                    )
                  }
                  persistent={persistent}
                  config={config}
                  onAction={refresh}
                  onBack={() => setMobileDetail(false)}
                  onPrevious={
                    position > 0
                      ? () => select(filtered[position - 1].ticket_id)
                      : null
                  }
                  onNext={
                    position >= 0 && position < filtered.length - 1
                      ? () => select(filtered[position + 1].ticket_id)
                      : null
                  }
                  position={position >= 0 ? position + 1 : "—"}
                  total={filtered.length}
                />
              ) : selected ? (
                <div className="processing-view">
                  <button
                    className="button mobile-back"
                    onClick={() => setMobileDetail(false)}
                  >
                    <Icon name="back" />
                    Back to queue
                  </button>
                  <AgentStatus events={events} ticketId={selected.ticket_id} />
                </div>
              ) : (
                <div className="workspace-empty">
                  <div className="empty-illustration">
                    <Icon name="inbox" size={36} />
                    <span>
                      <Icon name="check" size={14} />
                    </span>
                  </div>
                  <div className="eyebrow">A clearer way to support</div>
                  <h2>
                    {loading
                      ? "Opening your workspace…"
                      : "The next step starts here."}
                  </h2>
                  <p>
                    {loading
                      ? "Loading saved tickets and connecting to new activity."
                      : "Select a ticket to review its response, understand the evidence, and decide what happens next."}
                  </p>
                  {mode === "demo" && !loading && (
                    <button
                      className="button primary"
                      onClick={() => navigate("demo")}
                    >
                      <Icon name="flask" size={16} />
                      Explore the demo
                      <Icon name="arrow" size={16} />
                    </button>
                  )}
                  <span className="empty-footnote">
                    <Icon name="shield" size={14} />
                    Prepared by AI. Reviewed by you.
                  </span>
                </div>
              )}
            </div>
          </main>
        )}
        {view === "insights" && (
          <Insights
            tickets={currentTickets}
            mode={mode}
            updatedAt={updatedAt}
          />
        )}
        {view === "demo" && (
          <DemoLab
            mode={mode}
            loading={demoLoading}
            onLoad={loadDemo}
            error={demoError}
          />
        )}
      </div>
    </div>
  );
}
