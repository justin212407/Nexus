import React, { useState, useEffect } from "react";
import TicketQueue from "./components/TicketQueue";
import TechnicalBrief from "./components/TechnicalBrief";
import AgentStatus from "./components/AgentStatus";
import MetricsBar from "./components/MetricsBar";
import { useSSE } from "./hooks/useSSE";

const SCENARIOS = {
  checkout_bug: {
    label: "🔴 Checkout Bug",
    payload: {
      type: "conversation.user.created",
      data: {
        item: {
          id: `ticket_checkout_${Date.now()}`,
          user: { email: "customer@example.com" },
          conversation_message: {
            body: "Checkout is completely broken, users cannot complete payment",
          },
          created_at: new Date().toISOString().slice(0, 19),
          priority: "urgent",
          tags: { tags: [] },
        },
      },
    },
  },
  false_alarm: {
    label: "🟡 False Alarm",
    payload: {
      type: "conversation.user.created",
      data: {
        item: {
          id: `ticket_false_${Date.now()}`,
          user: { email: "confused@example.com" },
          conversation_message: {
            body: "I cannot log in but I think I forgot my password",
          },
          created_at: new Date().toISOString().slice(0, 19),
          priority: "normal",
          tags: { tags: [] },
        },
      },
    },
  },
  stripe_outage: {
    label: "🟠 Stripe Outage",
    payload: {
      type: "conversation.user.created",
      data: {
        item: {
          id: `ticket_stripe_${Date.now()}`,
          user: { email: "enterprise@example.com" },
          conversation_message: {
            body: "All payment processing is failing, Stripe returning 503 errors",
          },
          created_at: new Date().toISOString().slice(0, 19),
          priority: "urgent",
          tags: { tags: [] },
        },
      },
    },
  },
};

async function triggerScenario(scenarioKey) {
  const scenario = SCENARIOS[scenarioKey];
  const payload = JSON.parse(JSON.stringify(scenario.payload));
  payload.data.item.id = `ticket_${scenarioKey}_${Date.now()}`;

  try {
    const response = await fetch("http://localhost:8000/webhook/intercom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "sha256=demo_bypass",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("Triggered:", data);
  } catch (err) {
    console.error("Trigger failed:", err);
  }
}

export default function App() {
  const { events, connected } = useSSE("http://localhost:8000/stream");
  const [triggering, setTriggering] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  // Extract selected brief from events
  const selectedBrief = selectedTicketId
    ? events.find(
        (e) => e.event === "completed" && e.ticket_id === selectedTicketId,
      )?.brief || null
    : null;

  const handleTrigger = async (key) => {
    setTriggering(key);
    await triggerScenario(key);
    setTimeout(() => setTriggering(null), 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <nav className="bg-black/50 border-b border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-sm">
              Z
            </div>
            <h1 className="text-xl font-bold tracking-tight">NEXUS</h1>
          </div>
          <span
            className="text-xs px-3 py-1 rounded-full border"
            style={{
              borderColor: connected ? "#10b981" : "#6b7280",
              backgroundColor: connected
                ? "rgba(16, 185, 129, 0.1)"
                : "rgba(107, 114, 128, 0.1)",
              color: connected ? "#10b981" : "#9ca3af",
            }}
          >
            {connected ? "● Live" : "○ Connecting..."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {Object.entries(SCENARIOS).map(([key, scenario]) => (
            <button
              key={key}
              onClick={() => handleTrigger(key)}
              disabled={triggering === key}
              className="text-xs px-3 py-2 border border-slate-600 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all font-medium hover:border-slate-500"
            >
              {triggering === key ? "Sending..." : scenario.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
        {/* Left Column: Ticket Queue */}
        <div className="md:col-span-1">
          <div className="sticky top-24">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Tickets ({events.filter((e) => e.event === "started").length})
            </h2>
            <TicketQueue
              events={events}
              onSelectTicket={setSelectedTicketId}
              selectedTicketId={selectedTicketId}
            />
          </div>
        </div>

        {/* Middle Column: Technical Brief + Agent Status */}
        <div className="md:col-span-1 space-y-6">
          {selectedTicketId ? (
            <>
              <AgentStatus events={events} ticketId={selectedTicketId} />
              <TechnicalBrief brief={selectedBrief} />
            </>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center text-slate-400">
              <p className="text-sm">Select a ticket to view details</p>
            </div>
          )}
        </div>

        {/* Right Column: Metrics */}
        <div className="md:col-span-1">
          <div className="sticky top-24">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Analytics
            </h2>
            <MetricsBar events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}
