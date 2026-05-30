import React, { useState } from "react";
import TicketQueue from "./components/TicketQueue";
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
          conversation_message: { body: "Checkout is completely broken, users cannot complete payment" },
          created_at: new Date().toISOString().slice(0, 19),
          priority: "urgent",
          tags: { tags: [] }
        }
      }
    }
  },
  false_alarm: {
    label: "🟡 False Alarm",
    payload: {
      type: "conversation.user.created",
      data: {
        item: {
          id: `ticket_false_${Date.now()}`,
          user: { email: "confused@example.com" },
          conversation_message: { body: "I cannot log in but I think I forgot my password" },
          created_at: new Date().toISOString().slice(0, 19),
          priority: "normal",
          tags: { tags: [] }
        }
      }
    }
  },
  stripe_outage: {
    label: "🟠 Stripe Outage",
    payload: {
      type: "conversation.user.created",
      data: {
        item: {
          id: `ticket_stripe_${Date.now()}`,
          user: { email: "enterprise@example.com" },
          conversation_message: { body: "All payment processing is failing, Stripe returning 503 errors" },
          created_at: new Date().toISOString().slice(0, 19),
          priority: "urgent",
          tags: { tags: [] }
        }
      }
    }
  }
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

  const handleTrigger = async (key) => {
    setTriggering(key);
    await triggerScenario(key);
    setTimeout(() => setTriggering(null), 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">NEXUS</h1>
          <span className={`text-xs px-2 py-1 rounded-full ${
            connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}>
            {connected ? "● Live" : "○ Connecting..."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {Object.entries(SCENARIOS).map(([key, scenario]) => (
            <button
              key={key}
              onClick={() => handleTrigger(key)}
              disabled={triggering === key}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
            >
              {triggering === key ? "Sending..." : scenario.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Live Ticket Queue
          </h2>
          <span className="text-xs text-gray-400">{events.length} events received</span>
        </div>
        <TicketQueue events={events} />
      </div>
    </div>
  );
}
