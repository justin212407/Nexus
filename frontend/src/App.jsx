import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  FlaskConical,
  Inbox as InboxIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Icon, { Logo } from "./components/Icon";
import TicketQueue from "./components/TicketQueue";
import TechnicalBrief from "./components/TechnicalBrief";
import AgentStatus from "./components/AgentStatus";
import Insights from "./components/Insights";
import DemoLab from "./components/DemoLab";
import { useIsMobile } from "./hooks/use-mobile";
import { useDrafts, useWorkspace } from "./hooks/useWorkspace";
import {
  draftKey,
  request,
  reviewState,
  sortTickets,
  ticketTitle,
} from "./lib/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import Spotlight from "./components/motion/Spotlight";

const SCENARIOS = [
  ["checkout_bug", "Checkout Bug"],
  ["false_alarm", "False Alarm"],
  ["stripe_outage", "Stripe Outage"],
];

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
  const isMobile = useIsMobile();
  const [view, setView] = useState(readView);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("open");
  const [severity, setSeverity] = useState("all");
  const [scope, setScope] = useState("current");
  const [mobileDetail, setMobileDetail] = useState(false);
  const [demoLoading, setDemoLoading] = useState(null);
  const [demoError, setDemoError] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const queuePanelRef = useRef(null);
  const mode = config?.mode;

  useEffect(() => {
    const handler = () => setView(readView());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  const toggleQueue = () => {
    if (queueCollapsed) {
      queuePanelRef.current?.expand();
    } else {
      queuePanelRef.current?.collapse();
    }
  };

  const filteredSelectionNotice = selected && position < 0 && (
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
  );

  const detail = selected ? (
    selected.brief && selected.status !== "failed" ? (
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
          position > 0 ? () => select(filtered[position - 1].ticket_id) : null
        }
        onNext={
          position >= 0 && position < filtered.length - 1
            ? () => select(filtered[position + 1].ticket_id)
            : null
        }
        position={position >= 0 ? position + 1 : "—"}
        total={filtered.length}
      />
    ) : (
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
    )
  ) : (
    <div className="workspace-empty relative overflow-hidden">
      <Spotlight className="-z-10" />
      <div className="empty-illustration">
        <Icon name="inbox" size={36} />
        <span>
          <Icon name="check" size={14} />
        </span>
      </div>
      <div className="eyebrow">A clearer way to support</div>
      <h2>{loading ? "Opening your workspace…" : "The next step starts here."}</h2>
      <p>
        {loading
          ? "Loading saved tickets and connecting to new activity."
          : "Select a ticket to review its response, understand the evidence, and decide what happens next."}
      </p>
      {mode === "demo" && !loading && (
        <button className="button primary" onClick={() => navigate("demo")}>
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
  );

  const queueProps = {
    tickets: filtered,
    selectedId,
    onSelect: select,
    search,
    onSearch: setSearch,
    filter,
    onFilter: setFilter,
    severity,
    onSeverity: setSeverity,
    scope,
    onScope: changeScope,
    mode,
    total: environmentTickets.length,
    loading,
    onDemo: () => navigate("demo"),
    onRefresh: refresh,
  };

  return (
    <div className="flex h-dvh min-h-[420px] flex-col overflow-hidden">
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
      <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 border-b bg-card px-4 py-1.5 md:px-6">
        <a
          className="flex items-center gap-2 text-[15px] font-bold tracking-wide"
          href="#inbox"
          aria-label="NEXUS home"
        >
          <Logo />
          <span>NEXUS</span>
        </a>
        <Separator orientation="vertical" className="hidden h-5 md:block" />
        <span className="hidden text-[13px] text-muted-foreground md:inline">
          Support workspace
        </span>
        {view === "inbox" && !isMobile && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleQueue}
            aria-label={queueCollapsed ? "Expand queue" : "Collapse queue"}
          >
            {queueCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        )}
        <nav
          className="order-last flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto"
          aria-label="Main navigation"
        >
          {[
            { id: "inbox", label: "Inbox", icon: InboxIcon },
            { id: "insights", label: "Insights", icon: BarChart3 },
            ...(mode === "demo"
              ? [{ id: "demo", label: "Demo lab", icon: FlaskConical }]
              : []),
          ].map(({ id, label, icon: NavIcon }) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              onClick={() => navigate(id)}
              className={
                view === id ? "bg-accent text-accent-foreground" : undefined
              }
              aria-current={view === id ? "page" : undefined}
            >
              <NavIcon />
              {label}
              {id === "inbox" && pendingCount > 0 && (
                <span className="rounded-md bg-primary px-1.5 text-[11px] font-semibold leading-4 text-primary-foreground">
                  {pendingCount}
                </span>
              )}
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <span
            className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"
            title={
              connected
                ? "Event stream connected"
                : "Waiting for the event stream; saved tickets remain available"
            }
          >
            <span
              className={`size-1.5 rounded-full ${
                connected
                  ? "bg-emerald-500"
                  : "animate-pulse bg-muted-foreground/50"
              }`}
            />
            {connected ? "Connected" : "Reconnecting"}
          </span>
          {mode === "demo" ? (
            <Badge
              variant="outline"
              className="gap-1.5 bg-demo-foreground text-demo"
            >
              <FlaskConical className="size-3" />
              Demo workspace
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1.5 bg-muted/50 text-muted-foreground"
            >
              <ShieldCheck className="size-3" />
              {mode === "live"
                ? "Live workspace"
                : loading
                  ? "Checking mode…"
                  : "Mode unavailable"}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => setCommandOpen(true)}
            aria-label="Search tickets and views"
          >
            <Search className="size-3.5" />
            <span className="hidden md:inline">Search</span>
            <kbd className="pointer-events-none hidden rounded bg-muted px-1.5 font-mono text-[10px] md:inline">
              ⌘K
            </kbd>
          </Button>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 border-b bg-warning-foreground px-6 py-2 text-xs text-warning"
        >
          <TriangleAlert className="size-4 shrink-0" />
          <span>
            {error} {tickets.length ? "Showing the last loaded tickets." : ""}
          </span>
          <Button
            variant="link"
            size="xs"
            className="underline"
            onClick={refresh}
          >
            Try again
          </Button>
        </div>
      )}
      <div
        className="min-h-0 flex-1 outline-none"
        id="main-content"
        tabIndex={-1}
      >
        {view === "inbox" &&
          (isMobile ? (
            mobileDetail && selected ? (
              <div className="flex h-full min-h-0 min-w-0 flex-col bg-card">
                {filteredSelectionNotice}
                {detail}
              </div>
            ) : (
              <div className="h-full">
                <TicketQueue {...queueProps} />
              </div>
            )
          ) : (
            <ResizablePanelGroup orientation="horizontal" className="h-full">
              <ResizablePanel
                panelRef={queuePanelRef}
                defaultSize="24%"
                minSize="19%"
                maxSize="34%"
                collapsible
                collapsedSize="0%"
                onResize={(size) => setQueueCollapsed(size.asPercentage <= 1)}
                className="overflow-hidden"
              >
                <div className="flex h-full min-h-0 flex-col [&>aside]:flex-1">
                  <TicketQueue {...queueProps} />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize="76%">
                <div className="flex h-full min-h-0 min-w-0 flex-col bg-card">
                  {filteredSelectionNotice}
                  {detail}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ))}
        {view === "insights" && (
          <Insights
            tickets={currentTickets}
            mode={mode}
            updatedAt={updatedAt}
          />
        )}
        {view === "demo" &&
          (mode === "demo" ? (
            <DemoLab
              mode={mode}
              loading={demoLoading}
              onLoad={loadDemo}
              error={demoError}
            />
          ) : (
            <DemoUnavailable loading={loading} onBack={() => navigate("inbox")} />
          ))}
      </div>

      <Toaster position="bottom-right" richColors />

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <Command>
          <CommandInput placeholder="Search tickets, jump to a view, or run a demo scenario…" />
          <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Go to">
            <CommandItem onSelect={() => navigate("inbox")}>
              <InboxIcon className="size-4" />
              Inbox
            </CommandItem>
            <CommandItem onSelect={() => navigate("insights")}>
              <BarChart3 className="size-4" />
              Insights
            </CommandItem>
            {mode === "demo" && (
              <CommandItem onSelect={() => navigate("demo")}>
                <FlaskConical className="size-4" />
                Demo lab
              </CommandItem>
            )}
          </CommandGroup>
          {environmentTickets.length > 0 && (
            <CommandGroup heading="Tickets">
              {environmentTickets.slice(0, 8).map((ticket) => (
                <CommandItem
                  key={ticket.ticket_id}
                  value={`${ticket.ticket_id} ${ticket.customer_email} ${
                    ticket.brief?.summary ?? ""
                  } ${ticket.brief?.affected_service ?? ""}`}
                  onSelect={() => {
                    select(ticket.ticket_id);
                    navigate("inbox");
                  }}
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {ticket.ticket_id}
                  </span>
                  <span className="truncate">
                    {ticketTitle(ticket) || ticket.customer_email}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {mode === "demo" && (
            <CommandGroup heading="Demo scenarios">
              {SCENARIOS.map(([key, label]) => (
                <CommandItem key={key} onSelect={() => loadDemo(key)}>
                  <FlaskConical className="size-4" />
                  {label}
                </CommandItem>
              ))}
          </CommandGroup>
        )}
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  );
}

function DemoUnavailable({ loading, onBack }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
          <FlaskConical className="size-6" />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">
          {loading ? "Checking workspace mode…" : "Demo lab is unavailable"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading
            ? "Waiting for the backend to report its workspace mode."
            : "Sample scenarios are available only when the backend confirms demo mode. Nothing here can affect live tickets."}
        </p>
        {!loading && (
          <Button variant="outline" className="mt-4" onClick={onBack}>
            Back to inbox
          </Button>
        )}
      </div>
    </div>
  );
}
