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

function TicketRow({ ticket, expanded, onToggle, isSelected, onSelect }) {
  const statusConfig = {
    processing: { label: "Processing", color: "bg-blue-500/20 text-blue-300", showSpinner: true },
    done: { label: "Done", color: "bg-emerald-500/20 text-emerald-300", showSpinner: false },
    error: { label: "Error", color: "bg-red-500/20 text-red-300", showSpinner: false },
  };
  const config = statusConfig[ticket.status] || statusConfig.processing;

  return (
    <div 
      className={`border rounded-lg overflow-hidden cursor-pointer transition-all smooth-transition ${
        isSelected 
          ? "border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/20" 
          : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
      }`}
      onClick={() => onSelect(ticket.ticket_id)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors text-left ${
          isSelected ? "hover:bg-blue-500/20" : "hover:bg-slate-700/50"
        }`}
      >
        <div className="flex items-center gap-3">
          {config.showSpinner && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-slate-200 font-mono">
            {ticket.ticket_id}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${config.color} border-current/30`}>
            {config.label}
          </span>
          {ticket.status === "done" && ticket.brief && (
            <>
              <span className="text-xs text-slate-400">
                {ticket.brief.root_cause?.replace(/_/g, " ")}
              </span>
              <span className="text-xs font-semibold text-slate-200">
                {ticket.brief.confidence_pct}%
              </span>
              <span className="text-xs text-slate-500">
                {ticket.brief.affected_users} users
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ticket.status === "processing" && (
            <ElapsedTimer startedAt={ticket.started_at} />
          )}
          <span className="text-slate-500 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && ticket.status === "done" && ticket.brief && (
        <div className="px-4 pb-4 border-t border-slate-700">
          <TechnicalBrief brief={ticket.brief} />
        </div>
      )}

      {expanded && ticket.status === "error" && (
        <div className="px-4 pb-4 border-t border-slate-700">
          <p className="text-sm text-red-400 mt-3">{ticket.error || "Unknown error"}</p>
        </div>
      )}

      {expanded && ticket.status === "processing" && (
        <div className="px-4 pb-4 border-t border-slate-700">
          <p className="text-sm text-slate-400 mt-3">Pipeline running...</p>
        </div>
      )}
    </div>
  );
}

export default function TicketQueue({ events, onSelectTicket, selectedTicketId }) {
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
          isSelected={selectedTicketId === ticket.ticket_id}
          onSelect={onSelectTicket}
        />
      ))}
    </div>
  );
}
