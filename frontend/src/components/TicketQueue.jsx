import React from "react";

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
      setElapsed(
        Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return <span style={{ fontSize: 12, color: "#888" }}>{elapsed}s</span>;
}

function TicketRow({ ticket, isSelected, onSelect }) {
  const statusDot = {
    processing: "#3b82f6",
    done: "#22c55e",
    error: "#ef4444",
  };

  const rcColors = {
    known_bug: "#ef4444",
    service_degradation: "#f97316",
    user_error: "#3b82f6",
    external_dependency: "#a855f7",
    unknown: "#666",
  };

  const dot = statusDot[ticket.status] || "#666";
  const rc = ticket.brief?.root_cause;
  const rcColor = rcColors[rc] || "#666";
  const rcLabel = rc ? rc.replace(/_/g, " ") : "";

  return (
    <div
      onClick={() => onSelect(ticket.ticket_id)}
      style={{
        padding: "10px 12px",
        borderRadius: "8px",
        border: `1px solid ${isSelected ? "#2a3a5a" : "#1a1a1a"}`,
        background: isSelected ? "rgba(59,130,246,0.06)" : "transparent",
        cursor: "pointer",
        marginBottom: "8px",
        transition: "all 0.12s",
        display: "flex",
        alignItems: "center",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = "#111";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = "transparent";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: ticket.status === "processing" ? "transparent" : dot,
              border:
                ticket.status === "processing" ? `2px solid ${dot}` : "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "4px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                color: "#fff",
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "180px",
              }}
            >
              #{String(ticket.ticket_id.split("_").slice(-1)[0]).slice(-6)}
            </span>
            {ticket.status === "done" && ticket.brief && (
              <span
                style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}
              >
                {ticket.brief.confidence_pct}%
              </span>
            )}
          </div>

          {ticket.status === "done" && ticket.brief ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: rcColor,
                  textTransform: "capitalize",
                }}
              >
                {rcLabel}
              </span>
              <span style={{ color: "#333", fontSize: "12px" }}>·</span>
              <span style={{ fontSize: "12px", color: "#888" }}>
                {ticket.brief.affected_users?.toLocaleString() || "—"}{" "}
                {ticket.brief.affected_users === 1 ? "user" : "users"}
              </span>
            </div>
          ) : ticket.status === "processing" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ElapsedTimer startedAt={ticket.started_at} />
              <span style={{ fontSize: "12px", color: "#888" }}>
                analyzing…
              </span>
            </div>
          ) : (
            <span style={{ fontSize: "12px", color: "#ef4444" }}>
              Pipeline error
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TicketQueue({
  events,
  onSelectTicket,
  selectedTicketId,
}) {
  const queue = buildQueue(events);

  if (queue.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "36px 16px" }}>
        <p style={{ color: "#888", fontSize: "13px", marginBottom: "8px" }}>
          No incidents yet
        </p>
        <p style={{ color: "#555", fontSize: "12px" }}>
          Trigger a scenario to begin
        </p>
      </div>
    );
  }

  return (
    <div>
      {queue.map((ticket) => (
        <TicketRow
          key={ticket.ticket_id}
          ticket={ticket}
          isSelected={selectedTicketId === ticket.ticket_id}
          onSelect={onSelectTicket}
        />
      ))}
    </div>
  );
}
