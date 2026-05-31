import { useState, useEffect, useRef } from "react";

export function useSSE(url) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const esRef = useRef(null);

  useEffect(() => {
    function connect() {
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        setConnected(true);
        setLastError(null);
      };

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setEvents((prev) => [...prev, data]);
        } catch {
          // ignore malformed events
        }
      };

      es.onerror = () => {
        setConnected(false);
        setLastError("Connection lost");
        es.close();
        // Auto-reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (esRef.current) esRef.current.close();
    };
  }, [url]);

  return { events, connected, lastError };
}
