import React, { useState } from "react";
import TechnicalBrief from "./components/TechnicalBrief";
import { useSSE } from "./hooks/useSSE";

const HARDCODED_BRIEF = {
  root_cause: "known_bug",
  confidence_pct: 91,
  severity: "high",
  summary: "Payment processor TypeError introduced in deploy abc123 causing checkout failures.",
  causal_chain: [
    "Sentry captured TypeError in payment_processor.charge()",
    "Deploy abc123 pushed 47 minutes before first error",
    "Engineering Slack thread flagged stripe-sdk version mismatch"
  ],
  engineer_summary: "Payment processor TypeError introduced in deploy abc123. Stripe SDK version pinned incorrectly.",
  draft_customer_response: "We have identified the root cause and our engineering team is deploying a fix now. Expected resolution within 30 minutes.",
  recommended_action: "Roll back deploy abc123 or pin stripe-sdk==5.4.0 in requirements.txt",
  signals_used: ["sentry", "slack", "deploy"],
  linear_issue_id: "LIN-2847"
};

export default function App() {
  const { events, connected } = useSSE("http://localhost:8000/stream");
  const [showHardcoded, setShowHardcoded] = useState(true);

  const latestBrief = events
    .filter(e => e.event === "completed" && e.brief)
    .map(e => e.brief)
    .at(-1);

  const briefToShow = showHardcoded ? HARDCODED_BRIEF : latestBrief;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">NEXUS</h1>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full ${connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {connected ? "● Live" : "○ Connecting..."}
            </span>
            <button
              onClick={() => setShowHardcoded(h => !h)}
              className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              {showHardcoded ? "Show Live" : "Show Demo"}
            </button>
          </div>
        </div>

        {showHardcoded && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-800">
            Demo mode — showing hardcoded Scenario A brief
          </div>
        )}

        <TechnicalBrief brief={briefToShow} />
      </div>
    </div>
  );
}
