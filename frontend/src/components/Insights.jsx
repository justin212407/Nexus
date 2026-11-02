import React from "react";
import Icon from "./Icon";
import NumberTicker from "./motion/NumberTicker";
import {
  ROOT_CAUSES,
  reviewState,
  relativeTime,
} from "../lib/workspace";
export default function Insights({ tickets, mode, updatedAt }) {
  const analyzed = tickets.filter((t) => t.brief);
  const review = analyzed.filter((t) => reviewState(t) === "review").length;
  const escalated = analyzed.filter((t) =>
    t.actions?.some((a) => a.action === "escalate"),
  ).length;
  const resolved = analyzed.filter((t) => t.review_resolved_at).length;
  const causes = Object.entries(ROOT_CAUSES).map(([key, label]) => ({
    key,
    label,
    count: analyzed.filter((t) => t.brief.root_cause === key).length,
  }));
  const serviceMap = new Map();
  for (const ticket of analyzed) {
    const service = ticket.brief.affected_service || "Unspecified";
    const current = serviceMap.get(service) || { count: 0, critical: 0 };
    current.count++;
    if (ticket.brief.severity === "critical") current.critical++;
    serviceMap.set(service, current);
  }
  const services = [...serviceMap.entries()].sort(
    (a, b) => b[1].count - a[1].count,
  );
  return (
    <main className="page-scroll">
      <div className="insights-page">
        <header className="page-heading">
          <div>
            <div className="eyebrow">Workspace overview</div>
            <h1>Insights</h1>
            <p>Understand the work coming in. Know where to focus next.</p>
          </div>
          <span className="scope-pill">
            <Icon name="clock" size={15} />
            {mode === "demo" ? "Demo" : mode === "live" ? "Live" : "Mode unavailable"} · Loaded history
          </span>
        </header>
        <div className="insights-stats">
          {[
            [
              "Analysed tickets",
              analyzed.length,
              "Saved technical briefs",
              "inbox",
            ],
            [
              "Awaiting review",
              review,
              "Ready for a human decision",
              "evidence",
            ],
            [
              "Escalated",
              escalated,
              "Tickets with a recorded simulation",
              "slack",
            ],
            [
              "Resolved in NEXUS",
              resolved,
              "Workspace resolution only",
              "check",
            ],
          ].map(([label, value, hint, icon]) => (
            <section className="insight-stat" key={label}>
              <div>
                <span>{label}</span>
                <Icon name={icon} size={17} />
              </div>
              <strong>
                <NumberTicker value={value} />
              </strong>
              <p>{hint}</p>
            </section>
          ))}
        </div>
        {!analyzed.length && (
          <div className="notice">
            <Icon name="info" />
            <p>
              There are no analysed tickets in this environment yet. Counts and
              breakdowns will appear as tickets are added.
            </p>
          </div>
        )}
        <div className="insights-grid">
          <section className="report-section">
            <header>
              <div>
                <h2>What’s behind the tickets</h2>
                <p>
                  Generated classifications across {analyzed.length} tickets
                </p>
              </div>
              <Icon name="chart" size={19} />
            </header>
            <div className="horizontal-bars">
              {causes.map(({ key, label, count }) => (
                <div className="bar-row" key={key}>
                  <div>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className="bar-track">
                    <span
                      style={{
                        width: `${analyzed.length ? (count / analyzed.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="fine-print">
              Classifications are model assessments. Review the evidence before
              acting.
            </p>
          </section>
          <section className="report-section">
            <header>
              <div>
                <h2>Priority distribution</h2>
                <p>Severity reported in each technical brief</p>
              </div>
              <Icon name="filter" size={19} />
            </header>
            <div className="severity-breakdown">
              {["critical", "high", "medium", "low"].map((level) => {
                const count = analyzed.filter(
                  (t) => t.brief.severity === level,
                ).length;
                return (
                  <div key={level}>
                    <span className={`severity-pill ${level}`}>{level}</span>
                    <div className="severity-bar">
                      <span
                        className={level}
                        style={{
                          width: `${analyzed.length ? (count / analyzed.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <strong>{count}</strong>
                  </div>
                );
              })}
            </div>
            <div className="insight-note">
              <Icon name="info" />
              <p>
                Priority helps you triage. Sending a reply or escalating does
                not automatically resolve a ticket.
              </p>
            </div>
          </section>
        </div>
        <section className="report-section services-report">
          <header>
            <div>
              <h2>Services in focus</h2>
              <p>Ticket volume by affected service</p>
            </div>
            <span className="count-badge">{services.length} services</span>
          </header>
          <div
            className="service-table"
            role="table"
            aria-label="Affected services"
          >
            <div className="service-table-head" role="row">
              <span role="columnheader">Service</span>
              <span role="columnheader">Tickets</span>
              <span role="columnheader">Critical</span>
              <span role="columnheader">Share of tickets</span>
            </div>
            {services.map(([service, { count, critical }]) => (
              <div className="service-table-row" role="row" key={service}>
                <span role="cell">
                  <Icon name="server" size={16} />
                  {service}
                </span>
                <strong role="cell">{count}</strong>
                <span role="cell">{critical || "—"}</span>
                <span role="cell" className="share-cell">
                  <span className="bar-track">
                    <span
                      style={{ width: `${(count / analyzed.length) * 100}%` }}
                    />
                  </span>
                  {Math.round((count / analyzed.length) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </section>
        <footer className="report-footer">
          <span>
            Based on {analyzed.length} unique{" "}
            {mode === "demo" ? "demo" : mode === "live" ? "live" : "current-environment"} tickets in the loaded history
            (up to 100 records). Imported history is excluded.
          </span>
          <span>Refreshed {relativeTime(updatedAt)}</span>
        </footer>
      </div>
    </main>
  );
}
