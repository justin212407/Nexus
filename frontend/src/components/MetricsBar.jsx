import { useEffect, useState } from "react";

export default function MetricsBar({ events }) {
  const [stats, setStats] = useState({
    total_incidents: 0,
    classification_breakdown: {},
    top_service: "unknown",
    avg_confidence_pct: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch initial stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("http://localhost:8000/stats");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Poll every 30s for fresh data
    return () => clearInterval(interval);
  }, []);

  // Update metrics when a new brief is completed
  useEffect(() => {
    const completedEvents = events.filter(
      (e) => e.event === "completed" && e.brief,
    );
    if (completedEvents.length === 0) return;

    const latestBrief = completedEvents[completedEvents.length - 1].brief;

    setStats((prevStats) => {
      const breakdown = { ...prevStats.classification_breakdown };
      const rootCause = latestBrief.root_cause;
      breakdown[rootCause] = (breakdown[rootCause] || 0) + 1;

      const total = prevStats.total_incidents + 1;
      const avgConfidence = Math.round(
        (prevStats.avg_confidence_pct * prevStats.total_incidents +
          latestBrief.confidence_pct) /
          total,
      );

      return {
        classification_breakdown: breakdown,
        total_incidents: total,
        avg_confidence_pct: avgConfidence,
        top_service: latestBrief.affected_service || prevStats.top_service,
      };
    });
  }, [events]);

  if (loading)
    return (
      <div style={{ color: "#888", padding: "12px" }}>Loading metrics...</div>
    );
  if (error)
    return (
      <div style={{ color: "#ef4444", padding: "12px" }}>
        Failed to load stats: {error}
      </div>
    );

  const breakdown = stats.classification_breakdown || {};
  const total = stats.total_incidents || 0;
  const topService = stats.top_service || "unknown";
  const avgConfidence = Math.round(stats.avg_confidence_pct || 0);

  // Render classification breakdown as horizontal bar
  const categories = [
    "known_bug",
    "service_degradation",
    "user_error",
    "external_dependency",
    "unknown",
  ];
  const colors = {
    known_bug: "#ef4444",
    service_degradation: "#f97316",
    user_error: "#f59e0b",
    external_dependency: "#8b5cf6",
    unknown: "#6b7280",
  };

  const segments = categories.map((cat) => {
    const count = breakdown[cat] || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { cat, count, pct, color: colors[cat] };
  });

  return (
    <div style={{ color: "#ddd", fontSize: 13 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 700, color: "#888" }}>
          Incidents Today: <span style={{ color: "#fff" }}>{total}</span>
        </div>
        <div style={{ color: "#888" }}>
          Avg Confidence:{" "}
          <span style={{ color: "#fff", fontWeight: 700 }}>
            {avgConfidence}%
          </span>
        </div>
        <div style={{ color: "#888" }}>
          Top:{" "}
          <span
            style={{
              color: "#fff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "80px",
              display: "inline-block",
              verticalAlign: "bottom",
            }}
          >
            {topService}
          </span>
        </div>
      </div>

      <div
        style={{
          height: 12,
          background: "#111",
          border: "1px solid #1a1a1a",
          borderRadius: 8,
          overflow: "hidden",
          display: "flex",
        }}
      >
        {segments
          .filter((s) => s.count > 0)
          .map((seg) => (
            <div
              key={seg.cat}
              title={`${seg.cat}: ${seg.count} (${seg.pct}%)`}
              style={{
                width: `${seg.pct}%`,
                background: seg.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {seg.pct > 15 && (
                <span
                  style={{ fontSize: 11, color: "#0a0a0a", fontWeight: 700 }}
                >
                  {seg.pct}%
                </span>
              )}
            </div>
          ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 12,
        }}
      >
        {segments.map((seg) => (
          <div
            key={seg.cat}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: seg.color,
              }}
            />
            <div style={{ color: "#888" }}>
              {seg.cat}:{" "}
              <span style={{ color: "#fff", fontWeight: 700 }}>
                {" "}
                {seg.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
