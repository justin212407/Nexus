import React from "react";
import Icon from "./Icon";
export default function AgentStatus({ events, ticketId }) {
  const own = events.filter((e) => e.ticket_id === ticketId);
  const error = own.findLast((e) => e.event === "error");
  const sources = own.findLast((e) => e.event === "sources_checked");
  return (
    <div className="processing-content">
      <span className={`processing-symbol ${error ? "failed" : ""}`}>
        {error ? (
          <Icon name="warning" size={26} />
        ) : (
          <Icon name="spark" size={26} />
        )}
      </span>
      <h2>
        {error
          ? "This investigation needs attention"
          : "Putting the pieces together"}
      </h2>
      <p>
        {error
          ? "The analysis could not be completed. Your ticket remains in the queue."
          : "NEXUS is correlating customer context with engineering signals. The response will be ready for your review."}
      </p>
      {error ? (
        <div className="notice error error-box" role="alert">
          {error.message}
        </div>
      ) : (
        <div className="processing-status" role="status">
          <span className="spinner" />
          Analysis in progress
        </div>
      )}
      {sources && (
        <div className="source-availability">
          <strong>Sources checked: {sources.source_count}/4 available</strong>
          <p>{sources.available_sources?.join(", ")}</p>
          {!sources.healthy && (
            <p className="warning-text">
              Investigation may be incomplete with fewer than 3 sources.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
