import React from "react";
import { Sparkles, TriangleAlert } from "lucide-react";

export default function AgentStatus({ events, ticketId }) {
  const own = events.filter((e) => e.ticket_id === ticketId);
  const error = own.findLast((e) => e.event === "error");
  const sources = own.findLast((e) => e.event === "sources_checked");
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
      <span
        className={`mb-5 grid size-16 place-items-center rounded-2xl ${
          error
            ? "bg-destructive/10 text-destructive"
            : "bg-accent text-primary"
        }`}
      >
        {error ? (
          <TriangleAlert className="size-7" />
        ) : (
          <Sparkles className="size-7" />
        )}
      </span>
      <h2 className="text-xl font-semibold tracking-tight">
        {error
          ? "This investigation needs attention"
          : "Putting the pieces together"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {error
          ? "The analysis could not be completed. Your ticket remains in the queue."
          : "NEXUS is correlating customer context with engineering signals. The response will be ready for your review."}
      </p>
      {error ? (
        <div
          role="alert"
          className="mt-5 flex w-full items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-left text-xs text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{error.message}</p>
        </div>
      ) : (
        <div
          role="status"
          className="mt-5 flex items-center gap-2 text-xs text-primary"
        >
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
          Analysis in progress
        </div>
      )}
      {sources && (
        <div className="mt-5 w-full rounded-lg border bg-muted/40 px-4 py-3 text-left text-xs text-ink-secondary">
          <strong className="font-medium">
            Sources checked: {sources.source_count}/4 available
          </strong>
          <p className="mt-1 text-muted-foreground">
            {sources.available_sources?.join(", ") || "None available"}
          </p>
          {!sources.healthy && (
            <p className="mt-1 text-warning">
              Investigation may be incomplete with fewer than 3 sources.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
