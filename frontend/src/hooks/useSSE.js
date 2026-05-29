import { useEffect, useRef, useState, useCallback } from 'react'

export function useSSE(url) {
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(false)
  const esRef = useRef(null)

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close()

    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        // Attach client-side timestamp for relative time display
        setEvents(prev => [...prev, { ...data, _ts: Date.now() }])
      } catch {
        // Ignore malformed events - never crash the dashboard
      }
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      // Auto-reconnect after 3 seconds
      setTimeout(connect, 3000)
    }
  }, [url])

  useEffect(() => {
    connect()
    return () => esRef.current?.close()
  }, [connect])

  const clearEvents = useCallback(() => setEvents([]), [])

  return { events, connected, clearEvents }
}
