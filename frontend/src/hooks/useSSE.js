import { useEffect, useRef, useState } from 'react'

export function useSSE(url) {
  const [events, setEvents] = useState([])
  const esRef = useRef(null)

  useEffect(() => {
    function connect() {
      const es = new EventSource(url)
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          setEvents((prev) => [...prev, data])
        } catch {}
      }

      es.onerror = () => {
        es.close()
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => esRef.current?.close()
  }, [url])

  return events
}
