import React from "react";
import Modal from "./Modal";
import Icon from "./Icon";
import { evidenceSources, ROOT_CAUSES, ticketCode } from "../lib/workspace";
export default function EvidencePanel({ ticket, onClose }) {
  const b = ticket.brief;
  const sources = evidenceSources(b);
  const confidence = Number(b.confidence_pct);
  return (
    <Modal title="Investigation evidence" onClose={onClose} drawer>
      <div className="drawer-body">
        <div className="eyebrow">{ticketCode(ticket)} · Technical brief</div>
        <h3 className="drawer-summary">
          {ROOT_CAUSES[b.root_cause] || "Undetermined"}
        </h3>
        <p>{b.engineer_summary}</p>
        <div className="evidence-facts">
          <div>
            <span>Service</span>
            <strong>{b.affected_service || "Not provided"}</strong>
          </div>
          <div>
            <span>Reported users affected</span>
            <strong>{b.affected_users ?? "Not provided"}</strong>
          </div>
          <div>
            <span>Model confidence</span>
            <strong>
              {Number.isFinite(confidence) &&
              confidence >= 0 &&
              confidence <= 100
                ? `${confidence}%`
                : "Unavailable"}
            </strong>
          </div>
          {b.linear_issue_id && (
            <div>
              <span>Related Linear issue</span>
              <strong className="mono">{b.linear_issue_id}</strong>
            </div>
          )}
        </div>
        <p className="fine-print">
          Confidence is the model’s assessment, not a measure of verified
          accuracy. Source records are not included in this brief.
        </p>
        <section className="evidence-section">
          <h3>
            Sources referenced{" "}
            <span className="count-badge">{sources.length}</span>
          </h3>
          {sources.length ? (
            sources.map((source, i) => (
              <div className="source-row" key={source}>
                <span className="source-mark">{source.charAt(0)}</span>
                <div>
                  <strong>{source}</strong>
                  <span>Referenced in generated analysis</span>
                </div>
                <Icon name="info" size={15} />
              </div>
            ))
          ) : (
            <div className="notice warning">
              <Icon name="info" />
              <p>
                No matching signals were referenced. This does not establish
                that every system is healthy.
              </p>
            </div>
          )}
        </section>
        <section className="evidence-section">
          <h3>Analysis narrative</h3>
          <ol className="narrative">
            {b.causal_chain?.map((step, i) => (
              <li key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <p className="fine-print">
            Generated explanation. The sequence may include inferred
            relationships.
          </p>
        </section>
        <section className="evidence-section">
          <h3>Recommended next step</h3>
          <p>{b.recommended_action || "No recommendation provided."}</p>
        </section>
        {b.resolution_eta && (
          <div className="notice">
            <Icon name="clock" />
            <p>
              Suggested ETA: {b.resolution_eta}. Verify before communicating it.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
