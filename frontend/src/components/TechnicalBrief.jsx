import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Modal from "./Modal";
import EvidencePanel from "./EvidencePanel";
import {
  ACTION_LABELS,
  customerName,
  escalationText,
  evidenceSources,
  initials,
  relativeTime,
  request,
  reviewState,
  ROOT_CAUSES,
  STATE_LABELS,
  ticketCode,
  ticketTitle,
} from "../lib/workspace";

const labels = {
  reply: "customer reply",
  escalate: "Slack escalation",
  resolve: "resolution",
};
export default function TechnicalBrief({
  ticket,
  response,
  onResponse,
  persistent,
  config,
  onAction,
  onBack,
  onPrevious,
  onNext,
  position,
  total,
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [tab, setTab] = useState("response");
  const [approval, setApproval] = useState(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const submission = useRef(false);
  const closeApproval = useCallback(() => setApproval(null), []);
  const closeEvidence = useCallback(() => setEvidenceOpen(false), []);
  const b = ticket.brief;
  const state = reviewState(ticket);
  const dirty = response !== (b.draft_customer_response || "");
  const canAct =
    config?.mode === "demo" &&
    config.simulated_actions &&
    ticket.environment === "demo" &&
    state !== "resolved";
  const sources = evidenceSources(b);
  useEffect(() => {
    setApproval(null);
  }, [
    response,
    ticket.ticket_id,
    ticket.customer_email,
    config?.slack_channel,
    canAct,
  ]);
  const prepare = (action) => {
    if (!canAct || submission.current) return;
    setActionError(null);
    setApproval({
      action,
      request_id: crypto.randomUUID(),
      ticket_id: ticket.ticket_id,
      content:
        action === "reply"
          ? response
          : action === "escalate"
            ? escalationText(ticket)
            : "",
      destination:
        action === "reply"
          ? ticket.customer_email
          : action === "escalate"
            ? config.slack_channel
            : "NEXUS workspace",
    });
  };
  const confirm = async () => {
    if (
      submission.current ||
      !approval ||
      approval.ticket_id !== ticket.ticket_id ||
      (approval.action === "reply" && approval.content !== response)
    )
      return;
    submission.current = true;
    setPending(true);
    setActionError(null);
    try {
      const result = await request(
        `/tickets/${encodeURIComponent(ticket.ticket_id)}/${approval.action}`,
        { method: "POST", body: JSON.stringify(approval) },
      );
      if (result.status !== "simulated")
        throw new Error("The outcome could not be confirmed.");
      setFeedback(
        `${ACTION_LABELS[approval.action]}. ${approval.action === "resolve" ? "Only this NEXUS review record was updated." : "No external message was sent."}`,
      );
      setApproval(null);
      await onAction();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setPending(false);
      submission.current = false;
    }
  };
  const message =
    ticket.message_body?.split("\n").slice(1).join("\n") || ticket.message_body;
  return (
    <section className="ticket-detail" aria-label="Selected ticket">
      <div className="detail-toolbar">
        <div className="breadcrumb">
          <button
            className="mobile-back icon-button"
            onClick={onBack}
            aria-label="Back to queue"
          >
            <Icon name="back" />
          </button>
          <Icon name="inbox" size={15} />
          <span>Inbox</span>
          <Icon name="chevron" size={13} />
          <span className="mono">{ticketCode(ticket)}</span>
        </div>
        <div className="ticket-pagination">
          <span>
            {position} of {total}
          </span>
          <button
            className="icon-button"
            onClick={onPrevious}
            disabled={!onPrevious}
            aria-label="Previous ticket"
          >
            <Icon name="chevron" className="rotate" size={16} />
          </button>
          <button
            className="icon-button"
            onClick={onNext}
            disabled={!onNext}
            aria-label="Next ticket"
          >
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </div>
      <div className="detail-scroll">
        <div className="detail-content">
          <div className="detail-heading">
            <div className="ticket-tags">
              <span className={`state-label ${state}`}>
                <i className={`status-dot ${state}`} />
                {STATE_LABELS[state]}
              </span>
              <span className={`severity-pill ${b.severity}`}>
                {b.severity} priority
              </span>
              {ticket.environment !== config?.mode && (
                <span className="environment-tag">Imported history</span>
              )}
            </div>
            <h1>{ticketTitle(ticket)}</h1>
            <div className="customer-line">
              <span
                className={`avatar tone-${(ticket.customer_email || "").length % 4}`}
              >
                {initials(ticket.customer_email)}
              </span>
              <div>
                <strong>{customerName(ticket.customer_email)}</strong>
                <span>{ticket.customer_email || "Email unavailable"}</span>
              </div>
              <time title={ticket.received_at || ticket.created_at}>
                Received {relativeTime(ticket.received_at || ticket.created_at)}
              </time>
            </div>
          </div>
          <div className="detail-tabs">
            <div role="tablist" aria-label="Ticket details">
              <button
                role="tab"
                aria-selected={tab === "response"}
                className={tab === "response" ? "active" : ""}
                onClick={() => setTab("response")}
              >
                Conversation
              </button>
              <button
                role="tab"
                aria-selected={tab === "activity"}
                className={tab === "activity" ? "active" : ""}
                onClick={() => setTab("activity")}
              >
                Activity <span>{ticket.actions?.length || 0}</span>
              </button>
            </div>
            <button
              className="evidence-trigger"
              onClick={() => setEvidenceOpen(true)}
            >
              <Icon name="evidence" size={16} />
              Evidence <span>{sources.length}</span>
              <Icon name="chevron" size={13} />
            </button>
          </div>
          {feedback && (
            <div className="notice success" role="status">
              <Icon name="check" />
              <p>{feedback}</p>
              <button
                className="icon-button"
                onClick={() => setFeedback(null)}
                aria-label="Dismiss action result"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          )}
          {tab === "response" ? (
            <>
              <section className="customer-message">
                <div className="section-label">
                  <Icon name="mail" size={15} />
                  <h2>Customer message</h2>
                  <span>Intercom</span>
                </div>
                <p>
                  {message ||
                    "The original message is not available for this historical ticket."}
                </p>
              </section>
              <section className="diagnosis-strip">
                <span className="diagnosis-icon">
                  <Icon name="spark" size={18} />
                </span>
                <div>
                  <div className="diagnosis-title">
                    <strong>
                      {ROOT_CAUSES[b.root_cause] || "Undetermined"}
                    </strong>
                    <span>{b.affected_service}</span>
                  </div>
                  <p>{b.summary}</p>
                  <button
                    className="text-button"
                    onClick={() => setEvidenceOpen(true)}
                  >
                    {sources.length
                      ? `${sources.length} sources referenced`
                      : "Review evidence limitations"}
                    <Icon name="arrow" size={13} />
                  </button>
                </div>
              </section>
              <section className="response-editor">
                <header>
                  <div>
                    <Icon name="mail" size={17} />
                    <h2>Customer reply</h2>
                  </div>
                  <span className="ai-label">
                    <Icon name="spark" size={13} />
                    AI-drafted
                  </span>
                </header>
                <div className="recipient">
                  <span>To</span>
                  <strong>
                    {ticket.customer_email || "Customer unavailable"}
                  </strong>
                  <span className="recipient-channel">via Intercom</span>
                </div>
                <label
                  className="sr-only"
                  htmlFor={`draft-${ticket.ticket_id}`}
                >
                  Customer reply draft
                </label>
                <textarea
                  id={`draft-${ticket.ticket_id}`}
                  value={response}
                  onChange={(e) => onResponse(e.target.value)}
                  maxLength={20000}
                  disabled={pending || state === "resolved"}
                  spellCheck="true"
                />
                <div className="editor-meta">
                  <span>
                    <i className={dirty ? "edited-dot" : ""} />
                    {dirty
                      ? `Edited · ${persistent ? "kept in this tab" : "kept while page is open"}`
                      : "Review and personalize before sending"}
                  </span>
                  {dirty && (
                    <button
                      className="text-button"
                      onClick={() =>
                        onResponse(b.draft_customer_response || "")
                      }
                      disabled={pending || state === "resolved"}
                    >
                      Restore AI draft
                    </button>
                  )}
                </div>
                <footer>
                  <button
                    className="button primary"
                    onClick={() => prepare("reply")}
                    disabled={!canAct || !response.trim() || pending}
                  >
                    <Icon name="send" size={16} />
                    Review reply
                    <Icon name="arrow" size={15} />
                  </button>
                  <button
                    className="button quiet"
                    onClick={() => prepare("escalate")}
                    disabled={!canAct || pending}
                  >
                    <Icon name="slack" size={16} />
                    Escalate
                  </button>
                  <button
                    className="button quiet resolve-button"
                    onClick={() => prepare("resolve")}
                    disabled={!canAct || pending}
                  >
                    <Icon name="check" size={16} />
                    Mark resolved
                  </button>
                </footer>
              </section>
              <div className="review-assurance">
                <Icon
                  name={config?.mode === "demo" ? "flask" : "shield"}
                  size={15}
                />
                <p>
                  {state === "resolved"
                    ? "This ticket is resolved in NEXUS. Its Intercom conversation has not been changed."
                    : ticket.environment !== "demo"
                      ? "Review and edit freely. Sending is not available for this ticket."
                      : "Demo workspace. Review actions are simulated; no external messages are sent."}
                </p>
              </div>
            </>
          ) : (
            <section className="activity-list">
              <div className="activity-entry">
                <span className="activity-icon">
                  <Icon name="spark" size={16} />
                </span>
                <div>
                  <strong>Analysis ready for review</strong>
                  <p>
                    A technical brief and response draft are available.{" "}
                    {ticket.environment
                      ? "No message was automatically sent by the review workflow."
                      : "Delivery history is unavailable for this imported record."}
                  </p>
                </div>
              </div>
              {(ticket.actions || []).map((a) => (
                <div className="activity-entry" key={a.request_id}>
                  <span className="activity-icon">
                    <Icon
                      name={
                        a.action === "resolve"
                          ? "check"
                          : a.action === "reply"
                            ? "mail"
                            : "slack"
                      }
                      size={16}
                    />
                  </span>
                  <div>
                    <div className="activity-title">
                      <strong>{ACTION_LABELS[a.action]}</strong>
                      <time>{relativeTime(a.created_at)}</time>
                    </div>
                    <p>
                      {a.destination} ·{" "}
                      {a.action === "resolve"
                        ? "Workspace only"
                        : "Simulated delivery"}
                    </p>
                    {a.content && (
                      <details>
                        <summary>View approved content</summary>
                        <p className="approved-content">{a.content}</p>
                      </details>
                    )}
                  </div>
                </div>
              ))}
              {!ticket.actions?.length && (
                <p className="fine-print activity-empty">
                  Your reviewed actions will appear here, separate from the
                  investigation evidence.
                </p>
              )}
            </section>
          )}
        </div>
      </div>
      {evidenceOpen && (
        <EvidencePanel ticket={ticket} onClose={closeEvidence} />
      )}
      {approval && (
        <Modal
          title={`Review ${labels[approval.action]}`}
          onClose={closeApproval}
          busy={pending}
        >
          <div className="approval-body">
            <div className="notice demo-notice">
              <Icon name="flask" />
              <p>
                This is a simulation. No customer or Slack message will be sent.
              </p>
            </div>
            <dl className="approval-facts">
              <div>
                <dt>Ticket</dt>
                <dd>{ticketCode(ticket)}</dd>
              </div>
              <div>
                <dt>
                  {approval.action === "reply" ? "Customer" : "Destination"}
                </dt>
                <dd>{approval.destination}</dd>
              </div>
              <div>
                <dt>Action</dt>
                <dd>
                  {approval.action === "resolve"
                    ? "Mark resolved in NEXUS only"
                    : approval.action === "reply"
                      ? "Simulate a customer-visible reply"
                      : "Simulate an internal Slack message"}
                </dd>
              </div>
            </dl>
            {approval.content ? (
              <div className="approval-content">{approval.content}</div>
            ) : (
              <p>
                This updates the NEXUS review state. It does not close the
                Intercom conversation or indicate that the underlying issue is
                fixed.
              </p>
            )}
            {actionError && (
              <div role="alert" className="notice error">
                <Icon name="warning" />
                <p>
                  {actionError} You can retry this same approval safely; it uses
                  the same request ID.
                </p>
              </div>
            )}
          </div>
          <footer className="modal-footer">
            <button
              className="button"
              onClick={closeApproval}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={confirm}
              disabled={pending}
            >
              {pending ? (
                <>
                  <span className="spinner" />
                  Recording…
                </>
              ) : approval.action === "resolve" ? (
                "Confirm resolution"
              ) : approval.action === "reply" ? (
                "Simulate reply"
              ) : (
                "Simulate escalation"
              )}
            </button>
          </footer>
        </Modal>
      )}
    </section>
  );
}
