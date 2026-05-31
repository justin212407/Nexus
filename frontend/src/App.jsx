import React, { useState, useEffect } from "react";
import TicketQueue from "./components/TicketQueue";
import TechnicalBrief from "./components/TechnicalBrief";
import AgentStatus from "./components/AgentStatus";
import MetricsBar from "./components/MetricsBar";
import { useSSE } from "./hooks/useSSE";

const SCENARIOS = {
  checkout_bug: { label: "Checkout Bug" },
  false_alarm: { label: "False Alarm" },
  stripe_outage: { label: "Stripe Outage" },
};

async function triggerScenario(scenarioKey) {
  const now = Date.now();
  const payload = {
    type: "conversation.user.created",
    data: {
      item: {
        id: `ticket_${scenarioKey}_${now}`,
        user: { email: `${scenarioKey}@example.com` },
        conversation_message: { body: `${scenarioKey} triggered` },
        created_at: new Date().toISOString().slice(0, 19),
        priority: scenarioKey === "checkout_bug" ? "urgent" : "normal",
        tags: { tags: [] },
      },
    },
  };

  try {
    await fetch("http://localhost:8000/webhook/intercom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "sha256=demo_bypass",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Trigger failed:", err);
  }
}

export default function App() {
  const { events, connected, lastError } = useSSE(
    "http://localhost:8000/stream",
  );
  const [mode, setMode] = useState(null);
  const [triggering, setTriggering] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then((r) => r.json())
      .then((d) => setMode(d.mode))
      .catch(() => setMode(null));
  }, []);

  const completedEvent = selectedTicketId
    ? events.find(
        (e) => e.event === "completed" && e.ticket_id === selectedTicketId,
      )
    : null;
  const selectedBrief = selectedTicketId
    ? completedEvent?.brief ||
      events.find((e) => e.ticket_id === selectedTicketId && e.brief)?.brief ||
      null
    : null;

  useEffect(() => {
    if (!selectedTicketId) return;
    console.debug("[NEXUS] selected ticket lookup", {
      selectedTicketId,
      completedEvent,
      selectedBrief,
      ticketEvents: events.filter((e) => e.ticket_id === selectedTicketId),
    });
  }, [completedEvent, events, selectedBrief, selectedTicketId]);

  const handleTrigger = async (key) => {
    setTriggering(key);
    await triggerScenario(key);
    setTimeout(() => setTriggering(null), 1500);
  };

  return (
    <div
      style={{
        background: "#0a0a0a",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "#fff",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      }}
    >
      {/* Top navbar */}
      <header
        style={{
          height: 48,
          borderBottom: "1px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>NEXUS</span>
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 6,
              background:
                mode === "demo"
                  ? "rgba(34,197,94,0.08)"
                  : "rgba(239,68,68,0.08)",
              color: mode === "demo" ? "#22c55e" : "#ef4444",
              border: `1px solid ${mode === "demo" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}`,
              fontWeight: 600,
            }}
          >
            {mode === "demo" ? "DEMO" : mode === "live" ? "LIVE" : "..."}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: connected ? "#22c55e" : "#666",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: connected ? "#22c55e" : "#444",
              }}
            />
            <div style={{ color: "#888" }}>
              {connected ? "Connected" : "Connecting"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {Object.keys(SCENARIOS).map((key) => (
            <button
              key={key}
              onClick={() => handleTrigger(key)}
              disabled={triggering === key}
              onMouseEnter={(e) => {
                if (triggering === key) return;
                e.currentTarget.style.background = "rgba(59,130,246,0.08)";
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                if (triggering === key) return;
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "#2a2a2a";
                e.currentTarget.style.color = "#888";
              }}
              style={{
                transition: "border-color 0.15s, color 0.15s, background 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${triggering === key ? "#2a2a2a" : "#2a2a2a"}`,
                background: triggering === key ? "#111" : "transparent",
                color: triggering === key ? "#fff" : "#888",
                fontWeight: 700,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "#3b82f6",
                }}
              />
              {triggering === key ? "Sending..." : SCENARIOS[key].label}
            </button>
          ))}
        </div>
      </header>

      {lastError && (
        <div
          style={{
            background: "rgba(234,179,8,0.08)",
            padding: "8px 24px",
            color: "#eab308",
          }}
        >
          {lastError}
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <aside
          style={{
            width: 320,
            minWidth: 320,
            borderRight: "1px solid #1a1a1a",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #1a1a1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#888",
                textTransform: "uppercase",
              }}
            >
              Incidents
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#555",
                background: "#111",
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #222",
              }}
            >
              {events.filter((e) => e.event === "started").length}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            <TicketQueue
              events={events}
              onSelectTicket={setSelectedTicketId}
              selectedTicketId={selectedTicketId}
            />
          </div>
        </aside>

        <main style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {selectedTicketId && selectedBrief ? (
            <TechnicalBrief brief={selectedBrief} />
          ) : selectedTicketId && !selectedBrief ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 200,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    border: "2px solid #222",
                    borderTopColor: "#3b82f6",
                    borderRadius: 999,
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 12px",
                  }}
                />
                <div style={{ color: "#555", fontSize: 13 }}>
                  Processing pipeline...
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 300,
              }}
            >
              <div style={{ textAlign: "center", maxWidth: 380 }}>
                <div style={{ textAlign: "center", maxWidth: "280px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      background: "#111",
                      border: "1px solid #1f1f1f",
                      borderRadius: "10px",
                      margin: "0 auto 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#333"
                      strokeWidth="1.5"
                    >
                      <path d="M9 12h6M9 16h6M9 8h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                    </svg>
                  </div>
                  <p
                    style={{
                      color: "#fff",
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "6px",
                    }}
                  >
                    No incident selected
                  </p>
                  <p
                    style={{
                      color: "#444",
                      fontSize: "12px",
                      lineHeight: "1.6",
                    }}
                  >
                    Trigger a scenario using the buttons above,
                    <br />
                    then click an incident to view the analysis.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>

        <aside
          style={{
            width: 260,
            minWidth: 260,
            borderLeft: "1px solid #1a1a1a",
            padding: 16,
          }}
        >
          <div
            style={{
              marginBottom: 12,
              color: "#888",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Analytics
          </div>
          <MetricsBar events={events} />
        </aside>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #222; border-radius: 4px; } * { box-sizing: border-box; }`}</style>
    </div>
  );
}
