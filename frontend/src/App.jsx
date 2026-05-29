import { useState } from 'react'
import { useSSE } from './hooks/useSSE'
import TicketQueue from './components/TicketQueue'
import AgentStatus from './components/AgentStatus'
import MetricsBar from './components/MetricsBar'

const SCENARIOS = [
  {
    id: 'ticket_checkout',
    label: '🔴 Checkout Bug',
    description: 'NullPointerException · 847 users · deploy 17min before ticket',
    style: 'border-red-200 bg-red-50 hover:bg-red-100 text-red-800',
    file: 'ticket_checkout.json',
  },
  {
    id: 'ticket_login',
    label: '🔵 False Alarm',
    description: 'Login issue · no technical errors · user error',
    style: 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800',
    file: 'ticket_login.json',
  },
  {
    id: 'ticket_payment',
    label: '🟣 Stripe Outage',
    description: 'Payment failures · external dependency · auto-escalate',
    style: 'border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800',
    file: 'ticket_payment.json',
  },
]

async function triggerScenario(file) {
  const res = await fetch(`/mock_data/${file}`)
  const payload = await res.json()
  return fetch('/webhook/intercom', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': 'sha256=demo_bypass',
    },
    body: JSON.stringify(payload),
  })
}

export default function App() {
  const { events, connected, clearEvents } = useSSE('/stream')
  const [triggering, setTriggering] = useState(null)

  // Find the most recently active ticket for AgentStatus
  const latestTicketId = events.length > 0
    ? [...events].reverse().find(e => e.ticket_id)?.ticket_id
    : null

  const handleTrigger = async (scenario) => {
    if (triggering) return
    setTriggering(scenario.id)
    try {
      await triggerScenario(scenario.file)
    } catch (e) {
      console.error('Trigger failed:', e)
    } finally {
      setTimeout(() => setTriggering(null), 1500)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">NEXUS</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Customer Escalation Intelligence · Coral Protocol
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
              connected
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
              {connected ? 'LIVE' : 'CONNECTING'}
            </div>
            <div className="text-xs font-semibold px-3 py-1.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
              DEMO MODE
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Scenario trigger buttons */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Trigger a Scenario
          </div>
          <div className="grid grid-cols-3 gap-3">
            {SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => handleTrigger(s)}
                disabled={!!triggering}
                className={`p-3 border rounded-xl text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${s.style}`}
              >
                <div className="text-sm font-semibold mb-1">
                  {triggering === s.id ? '⏳ Sending...' : s.label}
                </div>
                <div className="text-xs opacity-70 leading-snug">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Agent status pipeline - shows latest ticket's progress */}
        {latestTicketId && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Pipeline Status
            </div>
            <AgentStatus events={events} ticketId={latestTicketId} />
          </div>
        )}

        {/* Metrics bar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Incident Analytics
          </div>
          <MetricsBar />
        </div>

        {/* Ticket queue */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Investigation Queue ({events.filter(e => e.event === 'completed').length} complete)
            </div>
            {events.length > 0 && (
              <button
                onClick={clearEvents}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <TicketQueue events={events} />
        </div>

      </div>
    </div>
  )
}
