import React from "react";

const SEVERITY_COLORS = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const SEVERITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const ROOT_CAUSE_COLORS = {
  known_bug: "bg-red-100 text-red-800",
  service_degradation: "bg-orange-100 text-orange-800",
  user_error: "bg-blue-100 text-blue-800",
  external_dependency: "bg-purple-100 text-purple-800",
  unknown: "bg-gray-100 text-gray-600",
};

function ConfidenceScore({ pct }) {
  const color =
    pct >= 70 ? "text-green-600" : pct >= 50 ? "text-yellow-500" : "text-red-600";
  return (
    <span className={`text-3xl font-bold ${color}`}>{pct}%</span>
  );
}

function RootCausePill({ rootCause }) {
  const label = ROOT_CAUSE_LABELS[rootCause] || rootCause;
  const color = ROOT_CAUSE_COLORS[rootCause] || "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${color}`}>
      {label}
    </span>
  );
}

function SeverityPill({ severity }) {
  const label = SEVERITY_LABELS[severity] || severity;
  const color = SEVERITY_COLORS[severity] || "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${color}`}>
      {label}
    </span>
  );
}

function CausalChain({ chain }) {
  return (
    <div className="space-y-2">
      {chain.map((step, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
              {i + 1}
            </div>
            {i < chain.length - 1 && (
              <div className="w-0.5 h-4 bg-blue-200 mt-1" />
            )}
          </div>
          <p className="text-sm text-gray-700 pt-1">{step}</p>
        </div>
      ))}
    </div>
  );
}

export default function TechnicalBrief({ brief }) {
  if (!brief) {
      return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 text-gray-400 text-sm">
          No brief available yet.
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <RootCausePill rootCause={brief.root_cause} />
          {brief.severity && <SeverityPill severity={brief.severity} />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Confidence</span>
          <ConfidenceScore pct={brief.confidence_pct} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {brief.affected_service && (
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-500 mb-1">Service</h4>
            <p className="text-gray-700 font-medium">{brief.affected_service}</p>
          </div>
        )}
        {brief.affected_users !== undefined && (
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-500 mb-1">Affected Users</h4>
            <p className="text-gray-700 font-medium">{brief.affected_users}</p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Causal Chain
        </h3>
        <CausalChain chain={brief.causal_chain || []} />
      </div>

      {brief.engineer_summary && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Engineer Summary
          </h3>
          <p className="text-sm text-gray-700">{brief.engineer_summary}</p>
        </div>
      )}

      {brief.draft_customer_response && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Draft Customer Response
          </h3>
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 border border-gray-100">
            {brief.draft_customer_response}
          </div>
        </div>
      )}

      {brief.recommended_action && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Recommended Action
          </h3>
          <p className="text-sm font-medium text-gray-800">{brief.recommended_action}</p>
        </div>
      )}

      {brief.linear_issue_id && (
        <a
          href={`https://linear.app/issue/${brief.linear_issue_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
        >
          View Linear Issue {brief.linear_issue_id}
        </a>
      )}
    </div>
  );
}
