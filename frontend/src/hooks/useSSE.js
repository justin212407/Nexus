import { useEffect, useState } from "react";

export function useSSE(url) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  useEffect(() => {
    const source = new EventSource(url);
    source.onopen = () => {
      setConnected(true);
      setConnectionEpoch((n) => n + 1);
    };
    source.onerror = () => setConnected(false); // EventSource owns reconnection and cleanup.
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((previous) => [...previous.slice(-499), data]);
      } catch {
        /* Ignore malformed transport frames. */
      }
    };
    return () => source.close();
  }, [url]);
  return { events, connected, connectionEpoch };
}
