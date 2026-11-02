import React from "react";
import {
  ArrowRight,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  initials,
  customerName,
  relativeTime,
  reviewState,
  STATE_LABELS,
  ticketCode,
  ticketTitle,
} from "../lib/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATE_DOTS = {
  attention: "bg-destructive",
  review: "bg-primary",
  analyzing: "animate-pulse bg-muted-foreground",
  escalated: "bg-warning",
  replied: "bg-emerald-600",
  resolved: "bg-emerald-500",
};

const SEVERITY_TEXT = {
  critical: "text-destructive",
  high: "text-warning",
  medium: "text-muted-foreground",
  low: "text-muted-foreground",
};

function TicketRow({ ticket, selected, onSelect }) {
  const state = reviewState(ticket);
  const severity = ticket.brief?.severity;
  return (
    <button
      onClick={() => onSelect(ticket.ticket_id)}
      aria-current={selected ? "true" : undefined}
      className={`block w-full border-b border-l-2 px-5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
        selected
          ? "border-l-primary bg-accent"
          : "border-l-transparent hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-ink-secondary">
          {initials(ticket.customer_email)}
        </span>
        <span className="truncate text-xs font-medium text-ink-secondary">
          {customerName(ticket.customer_email)}
        </span>
        <time className="ml-auto shrink-0 text-xs text-muted-foreground">
          {relativeTime(ticket.received_at || ticket.created_at)}
        </time>
      </div>
      <span className="mt-1.5 block overflow-hidden text-[13px] font-medium leading-snug [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
        {ticketTitle(ticket)}
      </span>
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {ticketCode(ticket)}
        </span>
        <span
          className={`inline-flex items-center gap-1 ${
            SEVERITY_TEXT[severity] || "text-muted-foreground"
          }`}
        >
          <i className="size-1 rounded-full bg-current" />
          {severity ||
            (state === "attention" ? "Analysis failed" : "Analyzing")}
        </span>
      </div>
    </button>
  );
}

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
  const hasFilters = search || severity !== "all" || filter === "resolved";
  const severityItems = [
    { value: "all", label: "All priorities" },
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];
  const scopeItems = [
    {
      value: "current",
      label:
        mode === "demo"
          ? "Demo tickets"
          : mode === "live"
            ? "Live tickets"
            : "Workspace",
    },
    { value: "legacy", label: "Imported history" },
  ];
  return (
    <aside
      className="flex h-full min-h-0 flex-col bg-sidebar"
      aria-label="Ticket queue"
    >
      <div className="flex items-start justify-between gap-2 px-5 pb-4 pt-6">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            Inbox{" "}
            <Badge variant="secondary" className="px-1.5 text-[11px]">
              {total}
            </Badge>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            A little clarity for every escalation.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRefresh}
          aria-label="Refresh tickets"
        >
          <RefreshCw />
        </Button>
      </div>

      <div className="px-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search tickets"
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="h-9 pl-8 pr-8 text-xs"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute right-1.5 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
              onClick={() => onSearch("")}
            >
              <X />
            </Button>
          )}
        </div>

        <Tabs value={filter} onValueChange={onFilter} className="mt-3 gap-0">
          <TabsList
            variant="line"
            className="h-auto w-full justify-start gap-6 border-b p-0"
          >
            {[
              ["open", "Open"],
              ["all", "All"],
              ["resolved", "Resolved"],
            ].map(([key, label]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="px-0.5 pb-2.5 text-xs"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center justify-between gap-2 py-2.5">
          <Select
            value={severity}
            onValueChange={onSeverity}
            items={severityItems}
          >
            <SelectTrigger
              size="sm"
              aria-label="Filter severity"
              className="h-7 gap-1.5 border-0 bg-transparent px-0 text-xs text-ink-secondary shadow-none"
            >
              <SlidersHorizontal className="size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {severityItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scope} onValueChange={onScope} items={scopeItems}>
            <SelectTrigger
              size="sm"
              aria-label="Ticket environment"
              className="h-7 border-0 bg-transparent px-0 text-xs text-ink-secondary shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="px-5 py-4" aria-label="Loading tickets">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="space-y-2 border-t py-4 first:border-t-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            ))}
          </div>
        )}
        {!loading && !tickets.length && (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
              <ShieldCheck className="size-6" />
            </span>
            <h3 className="text-sm font-medium">
              {hasFilters ? "No matching tickets" : "You’re all caught up"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasFilters
                ? "Try a different filter or search."
                : mode === "demo"
                  ? "Load sample tickets to explore the review workflow."
                  : "Incoming tickets will appear here."}
            </p>
            {hasFilters ? (
              <Button
                variant="link"
                size="xs"
                className="mt-3 h-auto gap-1 p-0 text-xs"
                onClick={() => {
                  onSearch("");
                  onSeverity("all");
                  onFilter("open");
                }}
              >
                Clear filters
              </Button>
            ) : (
              mode === "demo" &&
              scope !== "legacy" && (
                <Button
                  variant="link"
                  size="xs"
                  className="mt-3 h-auto gap-1 p-0 text-xs"
                  onClick={onDemo}
                >
                  Explore demo scenarios <ArrowRight className="size-3.5" />
                </Button>
              )
            )}
          </div>
        )}
        {groups.map((state) => (
          <section key={state}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-y bg-muted/60 px-5 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              <span className="flex items-center gap-1.5">
                <i
                  className={`size-1.5 rounded-full ${
                    STATE_DOTS[state] || "bg-muted-foreground"
                  }`}
                />
                {STATE_LABELS[state]}
              </span>
              <span>
                {tickets.filter((t) => reviewState(t) === state).length}
              </span>
            </div>
            {tickets
              .filter((t) => reviewState(t) === state)
              .map((ticket) => (
                <TicketRow
                  key={ticket.ticket_id}
                  ticket={ticket}
                  selected={ticket.ticket_id === selectedId}
                  onSelect={onSelect}
                />
              ))}
          </section>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        <span>Every response starts with your review.</span>
      </div>
    </aside>
  );
}
