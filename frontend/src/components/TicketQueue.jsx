import React, { useState } from "react";
import TechnicalBrief from "./TechnicalBrief";

function buildQueue(events) {
  const map = new Map();
  for (const e of events) {
    if (e.event === "started") {
      map.set(e.ticket_id, {
        ticket_id: e.ticket_id,
        status: "processing",
        started_at: e.timestamp || Date.now(),
        brief: null,
        error: null,
      });
    } else if (e.event === "completed" && map.has(e.ticket_id)) {
      map.set(e.ticket_id, {
        ...map.get(e.ticket_id),
        status: "done",
        brief: e.brief,
        completed_at: e.timestamp || Date.now(),
      });
    } else if (e.event === "error" && map.has(e.ticket_id)) {
      map.set(e.ticket_id, {
        ...map.get(e.ticket_id),
        status: "error",
        error: e.error,
      });
    }
  }
  return Array.from(map.values()).reverse();
}

function ElapsedTimer({ startedAt }) {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return <span className="text-xs text-gray-400">{elapsed}s</span>;
}

function TicketRow({ ticket, expanded, onToggle }) {
  const statusConfig = {
    processing: { label: "Processing", color: "bg-blue-100 text-blue-700", showSpinner: true },
    done: { label: "Done", color: "bg-green-100 text-green-700", showSpinner: false },
    error: { label: "Error", color: "bg-red-100 text-red-700", showSpinner: false },
  };
  const config = statusConfig[ticket.status] || statusConfig.processing;

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {config.showSpinner && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-gray-800 font-mono">
            {ticket.ticket_id}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
            {config.label}
          </span>
          {ticket.status === "done" && ticket.brief && (
            <>
              <span className="text-xs text-gray-500">
                {ticket.brief.root_cause?.replace(/_/g, " ")}
              </span>
              <span className="text-xs font-semibold text-gray-700">
                {ticket.brief.confidence_pct}%
              </span>
              <span className="text-xs text-gray-400">
                {ticket.brief.affected_users} users
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ticket.status === "processing" && (
            <ElapsedTimer startedAt={ticket.started_at} />
          )}
          <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && ticket.status === "done" && ticket.brief && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <TechnicalBrief brief={ticket.brief} />
        </div>
      )}

      {expanded && ticket.status === "error" && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <p className="text-sm text-red-600 mt-3">{ticket.error || "Unknown error"}</p>
        </div>
      )}

      {expanded && ticket.status === "processing" && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <p className="text-sm text-gray-400 mt-3">Pipeline running...</p>
        </div>
      )}
    </div>
  );
}

export default function TicketQueue({ events }) {
  const [expanded, setExpanded] = useState(null);

  const queue = buildQueue(events);

  return (
    <div className="space-y-3">
      {queue.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">
          No tickets yet. Trigger a scenario to begin.
        </div>
      )}
      {queue.map((ticket) => (
        <TicketRow
          key={ticket.ticket_id}
          ticket={ticket}
          expanded={expanded === ticket.ticket_id}
          onToggle={() => setExpanded(
            expanded === ticket.ticket_id ? null : ticket.ticket_id
          )}
        />
      ))}
    </div>
  );
}
