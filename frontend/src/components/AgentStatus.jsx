export default function AgentStatus({ events, ticketId }) {
  const steps = ['started', 'coral_done', 'signal_done', 'synthesis_done', 'completed']
  const reached = events.filter((e) => e.ticket_id === ticketId).map((e) => e.event)

  return (
    <div>
      {steps.map((step) => (
        <div key={step} style={{ color: reached.includes(step) ? 'green' : '#ccc' }}>
          {reached.includes(step) ? '[x]' : '[ ]'} {step}
        </div>
      ))}
    </div>
  )
}
