import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeTickets, request } from "../lib/workspace";
import { useSSE } from "./useSSE";

export function useWorkspace() {
  const { events, connected, connectionEpoch } = useSSE("/stream");
  const [history, setHistory] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const [records, capabilities] = await Promise.all([
        request("/history?limit=100"),
        request("/tickets/config"),
      ]);
      if (version !== requestVersion.current) return;
      if (!Array.isArray(records))
        throw new Error("The ticket history could not be read.");
      setHistory(records);
      setConfig(capabilities);
      setError(null);
      setUpdatedAt(new Date().toISOString());
    } catch (err) {
      if (version === requestVersion.current) setError(err.message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
      requestVersion.current++;
    };
  }, [refresh]);
  useEffect(() => {
    if (connectionEpoch) refresh();
  }, [connectionEpoch, refresh]);
  const lastEvent = events[events.length - 1];
  useEffect(() => {
    if (
      lastEvent?.event === "completed" ||
      lastEvent?.event === "sync_required"
    )
      refresh();
  }, [lastEvent, refresh]);
  const tickets = useMemo(
    () => mergeTickets(history, events),
    [history, events],
  );
  return {
    tickets,
    config,
    loading,
    error,
    updatedAt,
    refresh,
    events,
    connected,
  };
}

const STORAGE_KEY = "nexus.review-drafts.v1";
export function useDrafts() {
  const [drafts, setDrafts] = useState(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    } catch {
      return {};
    }
  });
  const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
      setPersistent(true);
    } catch {
      setPersistent(false);
    }
  }, [drafts]);
  const updateDraft = useCallback(
    (key, value) => setDrafts((previous) => ({ ...previous, [key]: value })),
    [],
  );
  return { drafts, updateDraft, persistent };
}
