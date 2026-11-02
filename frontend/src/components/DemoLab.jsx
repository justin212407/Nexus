import React from "react";
import Icon from "./Icon";
const scenarios = [
  {
    key: "checkout",
    number: "01",
    name: "Checkout regression",
    icon: "code",
    severity: "high",
    headline: "Connect the dots behind a checkout failure.",
    description:
      "Review a suspected deployment regression, inspect the engineering context, and prepare a clear customer response.",
    sources: ["Sentry", "Slack", "GitHub"],
  },
  {
    key: "login",
    number: "02",
    name: "Login investigation",
    icon: "lock",
    severity: "low",
    headline: "Help a customer when the signals are quiet.",
    description:
      "Explore a ticket with no matching technical signals. Review the limits of the analysis and personalize the troubleshooting steps.",
    sources: ["No matching signals"],
  },
  {
    key: "payment",
    number: "03",
    name: "Payment provider outage",
    icon: "card",
    severity: "critical",
    headline: "Move from customer impact to a considered handoff.",
    description:
      "Review a critical external dependency diagnosis. Prepare a customer update and a separate internal escalation.",
    sources: ["Sentry", "Slack"],
  },
];
export default function DemoLab({ mode, loading, onLoad, error }) {
  const available = mode === "demo";
  return (
    <main className="page-scroll">
      <div className="demo-page">
        <div className="demo-intro">
          <div>
            <span className="environment-tag">
              <Icon name="flask" size={14} />
              Demo lab
            </span>
            <h1>Make yourself at home.</h1>
            <p>
              Six sample tickets. Three investigation paths.
              <br />
              Explore the complete review workflow in a safe workspace.
            </p>
          </div>
          <div className="demo-load">
            <button
              className="button primary"
              disabled={!available || !!loading}
              onClick={() => onLoad("all")}
            >
              {loading === "all" ? (
                <span className="spinner" />
              ) : (
                <Icon name="inbox" size={17} />
              )}
              Load sample workspace
              <Icon name="arrow" size={16} />
            </button>
            <span>Existing samples and your work are preserved.</span>
          </div>
        </div>
        {!available && (
          <div className="notice warning">
            <Icon name="info" />
            <p>
              {mode
                ? "This backend is in live mode. Demo samples are unavailable."
                : "Waiting for the backend to confirm the workspace environment."}
            </p>
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            <Icon name="warning" />
            <p>{error}</p>
          </div>
        )}
        <div className="scenario-grid">
          {scenarios.map((s) => (
            <article className="scenario" key={s.key}>
              <div className="scenario-top">
                <span className="scenario-icon">
                  <Icon name={s.icon} size={25} />
                </span>
                <span className="scenario-number">{s.number}</span>
              </div>
              <div className="scenario-name">
                <h2>{s.name}</h2>
                <span className={`severity-pill ${s.severity}`}>
                  {s.severity}
                </span>
              </div>
              <h3>{s.headline}</h3>
              <p>{s.description}</p>
              <div className="scenario-sources">
                {s.sources.map((source) => (
                  <span key={source}>{source}</span>
                ))}
              </div>
              <button
                className="button"
                onClick={() => onLoad(s.key)}
                disabled={!available || !!loading}
              >
                {loading === s.key ? <span className="spinner" /> : null}Open
                scenario
                <Icon name="arrow" size={16} />
              </button>
              <span className="fine-print">2 fictional customer tickets</span>
            </article>
          ))}
        </div>
        <section className="demo-principles">
          <div>
            <Icon name="shield" size={21} />
            <h3>A real flow. A safe place to try it.</h3>
            <p>
              Every sample is clearly labeled. Every outbound action is a
              simulation.
            </p>
          </div>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Investigate</strong>
                <p>Read the customer’s message and inspect the analysis.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Make it yours</strong>
                <p>
                  Edit the suggested response. Your draft stays with its ticket.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Review and confirm</strong>
                <p>
                  Check the exact message and destination before recording an
                  action.
                </p>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
