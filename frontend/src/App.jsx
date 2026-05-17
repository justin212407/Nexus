import { useSSE } from './hooks/useSSE'

export default function App() {
  const events = useSSE('/stream')

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>NEXUS - Customer Escalation Intelligence</h1>
      <p>SSE events received: {events.length}</p>
      <pre style={{ fontSize: 12, background: '#f5f5f5', padding: '1rem' }}>
        {JSON.stringify(events.slice(-5), null, 2)}
      </pre>
    </div>
  )
}
