import { useEffect, useState } from "react";

const CATEGORIES = [
  "known_bug",
  "service_degradation",
  "user_error",
  "external_dependency",
  "unknown",
];

const COLORS = {
  known_bug: "bg-rose-500",
  service_degradation: "bg-orange-500",
  user_error: "bg-blue-500",
  external_dependency: "bg-violet-500",
  unknown: "bg-slate-500",
};

const LABELS = {
  known_bug: "Known Bug",
  service_degradation: "Service Degradation",
  user_error: "User Error",
  external_dependency: "External Dependency",
  unknown: "Unknown",
};

export default function MetricsBar({ events }) {
  const [stats, setStats] = useState({
    total_incidents: 0,
    classification_breakdown: {},
    top_service: "unknown",
    avg_confidence_pct: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/stats");
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
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

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
    return <div className="text-sm text-slate-500 py-3">Loading metrics...</div>;
  if (error)
    return <div className="text-sm text-rose-600 py-3">Failed to load stats: {error}</div>;

  const breakdown = stats.classification_breakdown || {};
  const total = stats.total_incidents || 0;
  const topService = stats.top_service || "unknown";
  const avgConfidence = Math.round(stats.avg_confidence_pct || 0);

  const segments = CATEGORIES.map((cat) => {
    const count = breakdown[cat] || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { cat, count, pct };
  }).filter((seg) => seg.count > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
          <p className="text-slate-500 mb-0.5">Incidents</p>
          <p className="text-lg font-bold text-slate-900">{total}</p>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
          <p className="text-slate-500 mb-0.5">Avg Confidence</p>
          <p className="text-lg font-bold text-slate-900">{avgConfidence}%</p>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 min-w-0">
          <p className="text-slate-500 mb-0.5">Top Service</p>
          <p className="text-sm font-bold text-slate-900 truncate">{topService}</p>
        </div>
      </div>

      <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
        {segments.map((seg) => (
          <div
            key={seg.cat}
            title={`${LABELS[seg.cat]}: ${seg.count} (${seg.pct}%)`}
            className={`${COLORS[seg.cat]} h-full`}
            style={{ width: `${seg.pct}%` }}
          />
        ))}
      </div>

      <div className="space-y-2">
        {CATEGORIES.map((cat) => {
          const count = breakdown[cat] || 0;
          return (
            <div key={cat} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded ${COLORS[cat]}`} />
                <span className="text-slate-600">{LABELS[cat]}</span>
              </div>
              <span className="font-semibold text-slate-900">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
