import React from "react";

const RC_CONFIG = {
  known_bug: {
    label: "Known Bug",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.15)",
  },
  service_degradation: {
    label: "Service Degradation",
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
    border: "rgba(249,115,22,0.15)",
  },
  user_error: {
    label: "User Error",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.15)",
  },
  external_dependency: {
    label: "External Dependency",
    color: "#a855f7",
    bg: "rgba(168,85,247,0.08)",
    border: "rgba(168,85,247,0.15)",
  },
  unknown: {
    label: "Unknown",
    color: "#888",
    bg: "rgba(136,136,136,0.08)",
    border: "rgba(136,136,136,0.15)",
  },
};

const SEV_CONFIG = {
  critical: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.15)",
  },
  high: {
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
    border: "rgba(249,115,22,0.15)",
  },
  medium: {
    color: "#eab308",
    bg: "rgba(234,179,8,0.08)",
    border: "rgba(234,179,8,0.15)",
  },
  low: {
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.15)",
  },
};

function Badge({ label, color, bg, border }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: 700,
        color,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#888",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 10,
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

export default function TechnicalBrief({ brief }) {
  if (!brief) {
    return (
      <div
        style={{
          background: "#111",
          border: "1px solid #1a1a1a",
          borderRadius: 12,
          padding: 24,
          color: "#555",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        No analysis available
      </div>
    );
  }

  const rc = RC_CONFIG[brief.root_cause] || RC_CONFIG.unknown;
  const sev = SEV_CONFIG[brief.severity] || SEV_CONFIG.low;
  const conf = brief.confidence_pct;
  const confColor = conf >= 70 ? "#22c55e" : conf >= 50 ? "#eab308" : "#ef4444";

  return (
    <div
      style={{
        background: "#0d0d0d",
        border: "1px solid #1a1a1a",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Badge
            label={rc.label}
            color={rc.color}
            bg={rc.bg}
            border={rc.border}
          />
          <Badge
            label={brief.severity}
            color={sev.color}
            bg={sev.bg}
            border={sev.border}
          />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: confColor,
              lineHeight: 1,
            }}
          >
            {conf}
          </span>
          <span style={{ fontSize: 14, color: "#555", fontWeight: 600 }}>
            % confidence
          </span>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {brief.summary && (
          <Section title="Summary">
            <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>
              {brief.summary}
            </p>
          </Section>
        )}

        <div
          style={{
            display: "flex",
            gap: 24,
            marginBottom: 24,
            padding: "14px 16px",
            background: "#111",
            border: "1px solid #1a1a1a",
            borderRadius: 8,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 10,
                color: "#555",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Service
            </p>
            <p style={{ fontSize: 13, color: "#ccc", fontWeight: 600 }}>
              {brief.affected_service || "—"}
            </p>
          </div>
          <div>
            <p
              style={{
                fontSize: 10,
                color: "#555",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Affected Users
            </p>
            <p style={{ fontSize: 13, color: "#ccc", fontWeight: 600 }}>
              {brief.affected_users?.toLocaleString() || "—"}
            </p>
          </div>
          {brief.signals_used?.length > 0 && (
            <div>
              <p
                style={{
                  fontSize: 10,
                  color: "#555",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Signals
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {brief.signals_used.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: 11,
                      color: "#888",
                      background: "#1a1a1a",
                      border: "1px solid #252525",
                      padding: "4px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {brief.causal_chain?.length > 0 && (
          <Section title="Causal Chain">
            <div>
              {brief.causal_chain.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: i < brief.causal_chain.length - 1 ? 12 : 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: "#111",
                        border: "1px solid #2a2a2a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: "#555",
                        fontWeight: 700,
                      }}
                    >
                      {i + 1}
                    </div>
                    {i < brief.causal_chain.length - 1 && (
                      <div
                        style={{
                          width: 1,
                          height: 24,
                          background: "#1a1a1a",
                          marginTop: 6,
                        }}
                      />
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {brief.engineer_summary && (
          <Section title="Engineer Summary">
            <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
              {brief.engineer_summary}
            </p>
          </Section>
        )}

        {brief.draft_customer_response && (
          <Section title="Draft Customer Response">
            <div
              style={{
                background: "#111",
                border: "1px solid #1a1a1a",
                borderRadius: 8,
                padding: "14px 16px",
                borderLeft: "2px solid #2a2a2a",
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: "#888",
                  lineHeight: 1.7,
                  fontStyle: "italic",
                }}
              >
                {brief.draft_customer_response}
              </p>
            </div>
          </Section>
        )}

        {brief.recommended_action && (
          <Section title="Recommended Action">
            <p style={{ fontSize: 13, color: "#ccc", fontWeight: 600 }}>
              {brief.recommended_action}
            </p>
          </Section>
        )}

        {brief.linear_issue_id && (
          <a
            href={`https://linear.app/issue/${brief.linear_issue_id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              background: "transparent",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
              color: "#888",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.color = "#3b82f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2a2a2a";
              e.currentTarget.style.color = "#888";
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                background: "#a855f7",
              }}
            />
            {brief.linear_issue_id}
          </a>
        )}
      </div>
    </div>
  );
}
