import { useState } from 'react'
import TechnicalBrief from './TechnicalBrief'

// Map SSE event names to human-readable status labels
const STATUS_LABEL = {
  started:        'Analysing...',
  coral_done:     'Sources queried',
  signal_done:    'Signals extracted',
  synthesis_done: 'Claude reasoning...',
  completed:      'Complete',
  error:          'Error',
}

export default function TicketQueue({ events }) {
  const [expanded, setExpanded] = useState(null)

  // Build a map of ticket_id -> latest state from SSE event stream
  const ticketMap = events.reduce((map, ev) => {
    if (!ev.ticket_id) return map
    const existing = map[ev.ticket_id] || {
      ticket_id: ev.ticket_id,
      status: 'started',
      startedAt: ev._ts,
    }
    map[ev.ticket_id] = {
      ...existing,
      status:    ev.event || existing.status,
      brief:     ev.brief || existing.brief,
      error:     ev.message || existing.error,
      rowCount:  ev.row_count ?? existing.rowCount,
      signals:   ev.signals_found || existing.signals,
      lastUpdate: ev._ts,
    }
    return map
  }, {})

  const tickets = Object.values(ticketMap).sort((a, b) => b.startedAt - a.startedAt)

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No tickets yet. Click a scenario button above to trigger one.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tickets.map(ticket => {
        const isComplete = ticket.status === 'completed'
        const isError    = ticket.status === 'error'

        return (
          <div key={ticket.ticket_id}
            className="border border-gray-200 rounded-xl overflow-hidden bg-white">

            {/* Collapsed header row */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              onClick={() => setExpanded(expanded === ticket.ticket_id ? null : ticket.ticket_id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Status dot */}
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isComplete ? 'bg-green-500' :
                  isError    ? 'bg-red-500' :
                               'bg-blue-500 animate-pulse'
                }`} />

                {/* Ticket ID */}
                <span className="text-sm font-mono text-gray-700 truncate">
                  {ticket.ticket_id}
                </span>

                {/* Root cause pill */}
                {ticket.brief?.root_cause && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                    {ticket.brief.root_cause.replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-400">
                  {STATUS_LABEL[ticket.status] || ticket.status}
                </span>
                {ticket.brief?.confidence_pct != null && (
                  <span className={`text-xs font-bold ${
                    ticket.brief.confidence_pct >= 70 ? 'text-green-600' :
                    ticket.brief.confidence_pct >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {ticket.brief.confidence_pct}%
                  </span>
                )}
                <span className="text-gray-300 text-xs">
                  {expanded === ticket.ticket_id ? '▲' : '▼'}
                </span>
              </div>
            </button>

            {/* Expanded detail */}
            {expanded === ticket.ticket_id && (
              <div className="px-4 pb-4 border-t border-gray-100">
                {ticket.error && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg text-xs text-red-700 font-mono">
                    Error: {ticket.error}
                  </div>
                )}
                {ticket.brief ? (
                  <div className="mt-3">
                    <TechnicalBrief brief={ticket.brief} ticketId={ticket.ticket_id} />
                  </div>
                ) : !ticket.error ? (
                  <div className="mt-3 text-xs text-gray-400 text-center py-6">
                    Pipeline running...
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
