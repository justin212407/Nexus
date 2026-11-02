import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileText,
  FlaskConical,
  Hash,
  Mail,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const labels = {
  reply: "customer reply",
  escalate: "Slack escalation",
  resolve: "resolution",
};

const SEVERITY_STYLES = {
  critical: "border-destructive/25 bg-destructive/10 text-destructive",
  high: "border-warning/25 bg-warning-foreground text-warning",
  medium: "border-border bg-muted text-ink-secondary",
  low: "border-border bg-muted text-ink-secondary",
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
      const message = `${ACTION_LABELS[approval.action]}. ${
        approval.action === "resolve"
          ? "Only this NEXUS review record was updated."
          : "No external message was sent."
      }`;
      setFeedback(message);
      setApproval(null);
      toast.success(ACTION_LABELS[approval.action], {
        description:
          approval.action === "resolve"
            ? "Updated in the NEXUS review record only."
            : "Simulated. No external message was sent.",
      });
      await onAction();
    } catch (err) {
      setActionError(err.message);
      toast.error("The action could not be confirmed", {
        description: "You can retry the same approval safely.",
      });
    } finally {
      setPending(false);
      submission.current = false;
    }
  };
  const message =
    ticket.message_body?.split("\n").slice(1).join("\n") || ticket.message_body;
  const severityStyle =
    SEVERITY_STYLES[b.severity] || "border-border bg-muted text-ink-secondary";
  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-col"
      aria-label="Selected ticket"
    >
      <div className="flex h-12 min-h-12 items-center justify-between gap-3 border-b px-6">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="icon-sm"
            className="mobile-back"
            onClick={onBack}
            aria-label="Back to queue"
          >
            <ArrowLeft />
          </Button>
          <Mail className="size-4 shrink-0 opacity-70" />
          <span>Inbox</span>
          <ChevronRight className="size-3.5 shrink-0" />
          <span className="truncate font-mono text-ink-secondary">
            {ticketCode(ticket)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-2 text-xs text-muted-foreground">
            {position} of {total}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onPrevious}
            disabled={!onPrevious}
            aria-label="Previous ticket"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onNext}
            disabled={!onNext}
            aria-label="Next ticket"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-6 max-md:px-5">
          <div className="mb-6">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-ink-secondary">
                <span
                  className={`size-1.5 rounded-full ${
                    state === "resolved"
                      ? "bg-emerald-500"
                      : state === "attention"
                        ? "bg-destructive"
                        : "bg-primary"
                  }`}
                />
                {STATE_LABELS[state]}
              </span>
              <Badge variant="outline" className={severityStyle}>
                {b.severity} priority
              </Badge>
              {ticket.environment !== config?.mode && (
                <Badge variant="outline" className="bg-muted/50">
                  Imported history
                </Badge>
              )}
            </div>
            <h1 className="mb-4 max-w-2xl text-2xl font-semibold leading-snug tracking-tight [overflow-wrap:anywhere]">
              {ticketTitle(ticket)}
            </h1>
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-ink-secondary">
                {initials(ticket.customer_email)}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {customerName(ticket.customer_email)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {ticket.customer_email || "Email unavailable"}
                </p>
              </div>
              <time
                className="ml-auto shrink-0 text-xs text-muted-foreground"
                title={ticket.received_at || ticket.created_at}
              >
                Received {relativeTime(ticket.received_at || ticket.created_at)}
              </time>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mb-5 gap-0">
            <div className="flex items-center justify-between gap-3 border-b">
              <TabsList variant="line" className="h-auto gap-6 p-0">
                <TabsTrigger
                  value="response"
                  className="px-0.5 pb-3 text-xs"
                >
                  Conversation
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="px-0.5 pb-3 text-xs"
                >
                  Activity
                  <span className="ml-1 rounded bg-muted px-1.5 text-[11px] text-ink-secondary">
                    {ticket.actions?.length || 0}
                  </span>
                </TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="sm"
                className="mb-1 gap-1.5 text-xs text-ink-secondary"
                onClick={() => setEvidenceOpen(true)}
              >
                <FileText className="size-4" />
                Evidence
                <span className="rounded bg-muted px-1.5 text-[11px]">
                  {sources.length}
                </span>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>

            <TabsContent value="response" className="pt-5">
              {feedback && (
                <div
                  className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-success-foreground px-3.5 py-3 text-xs text-success"
                  role="status"
                >
                  <CircleCheck className="mt-0.5 size-4 shrink-0" />
                  <p className="flex-1">{feedback}</p>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setFeedback(null)}
                    aria-label="Dismiss action result"
                  >
                    <CircleCheck className="size-3.5" />
                  </Button>
                </div>
              )}

              <section className="mb-5">
                <div className="mb-2 flex items-center gap-2 text-xs text-ink-secondary">
                  <Mail className="size-4 text-muted-foreground" />
                  <h2 className="font-medium">Customer message</h2>
                  <span className="ml-auto text-muted-foreground">Intercom</span>
                </div>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  {message ||
                    "The original message is not available for this historical ticket."}
                </p>
              </section>

              <section className="mb-5 flex gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-xs font-semibold">
                      {ROOT_CAUSES[b.root_cause] || "Undetermined"}
                    </strong>
                    <span className="border-l pl-2 text-xs text-muted-foreground">
                      {b.affected_service}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                    {b.summary}
                  </p>
                  <Button
                    variant="link"
                    size="xs"
                    className="mt-1 h-auto gap-1 p-0 text-xs"
                    onClick={() => setEvidenceOpen(true)}
                  >
                    {sources.length
                      ? `${sources.length} sources referenced`
                      : "Review evidence limitations"}
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-input bg-card shadow-sm">
                <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    <h2 className="text-xs font-semibold">Customer reply</h2>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="size-3.5" />
                    AI-drafted
                  </span>
                </header>
                <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-xs text-muted-foreground">
                  <span>To</span>
                  <strong className="font-normal text-ink-secondary">
                    {ticket.customer_email || "Customer unavailable"}
                  </strong>
                  <span className="ml-auto max-sm:hidden">via Intercom</span>
                </div>
                <label
                  className="sr-only"
                  htmlFor={`draft-${ticket.ticket_id}`}
                >
                  Customer reply draft
                </label>
                <Textarea
                  id={`draft-${ticket.ticket_id}`}
                  value={response}
                  onChange={(e) => onResponse(e.target.value)}
                  maxLength={20000}
                  disabled={pending || state === "resolved"}
                  spellCheck="true"
                  className="min-h-[130px] resize-y rounded-none border-0 bg-transparent px-4 py-3 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                />
                <div className="flex min-h-8 items-center justify-between gap-2 px-4 pb-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {dirty && <i className="size-1.5 rounded-full bg-primary" />}
                    {dirty
                      ? `Edited · ${persistent ? "kept in this tab" : "kept while page is open"}`
                      : "Review and personalize before sending"}
                  </span>
                  {dirty && (
                    <Button
                      variant="link"
                      size="xs"
                      className="h-auto p-0 text-xs"
                      onClick={() =>
                        onResponse(b.draft_customer_response || "")
                      }
                      disabled={pending || state === "resolved"}
                    >
                      Restore AI draft
                    </Button>
                  )}
                </div>
                <footer className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-3.5 py-3">
                  <Button
                    onClick={() => prepare("reply")}
                    disabled={!canAct || !response.trim() || pending}
                  >
                    <Send />
                    Review reply
                    <ArrowRight />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => prepare("escalate")}
                    disabled={!canAct || pending}
                  >
                    <Hash />
                    Escalate
                  </Button>
                  <Button
                    variant="ghost"
                    className="ml-auto max-sm:ml-0"
                    onClick={() => prepare("resolve")}
                    disabled={!canAct || pending}
                  >
                    <Check />
                    Mark resolved
                  </Button>
                </footer>
              </section>

              <div className="mt-3 flex items-start gap-2 px-1 text-xs text-muted-foreground">
                {config?.mode === "demo" ? (
                  <FlaskConical className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                )}
                <p className="leading-relaxed">
                  {state === "resolved"
                    ? "This ticket is resolved in NEXUS. Its Intercom conversation has not been changed."
                    : ticket.environment !== "demo"
                      ? "Review and edit freely. Sending is not available for this ticket."
                      : "Demo workspace. Review actions are simulated; no external messages are sent."}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="pt-5">
              <section className="pb-5">
                <div className="relative flex gap-3.5 pb-6">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-ink-secondary">
                    <Sparkles className="size-4" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <strong className="text-xs font-medium">
                      Analysis ready for review
                    </strong>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      A technical brief and response draft are available.{" "}
                      {ticket.environment
                        ? "No message was automatically sent by the review workflow."
                        : "Delivery history is unavailable for this imported record."}
                    </p>
                  </div>
                </div>
                {(ticket.actions || []).map((a) => (
                  <div className="relative flex gap-3.5 pb-6" key={a.request_id}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-ink-secondary">
                      {a.action === "resolve" ? (
                        <Check className="size-4" />
                      ) : a.action === "reply" ? (
                        <Mail className="size-4" />
                      ) : (
                        <Hash className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs font-medium">
                          {ACTION_LABELS[a.action]}
                        </strong>
                        <time className="text-xs text-muted-foreground">
                          {relativeTime(a.created_at)}
                        </time>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.destination} ·{" "}
                        {a.action === "resolve"
                          ? "Workspace only"
                          : "Simulated delivery"}
                      </p>
                      {a.content && (
                        <details className="mt-2 text-xs text-ink-secondary">
                          <summary className="cursor-pointer text-primary">
                            View approved content
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-3 [overflow-wrap:anywhere]">
                            {a.content}
                          </p>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
                {!ticket.actions?.length && (
                  <p className="pl-11 text-xs leading-relaxed text-muted-foreground">
                    Your reviewed actions will appear here, separate from the
                    investigation evidence.
                  </p>
                )}
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {evidenceOpen && (
        <EvidencePanel ticket={ticket} onClose={closeEvidence} />
      )}

      <Dialog
        open={!!approval}
        onOpenChange={(open) => {
          if (!open && !pending) closeApproval();
        }}
      >
        <DialogContent className="max-w-xl" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>
              {approval ? `Review ${labels[approval.action]}` : "Review action"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Confirm the exact action, destination and content before
              submitting.
            </DialogDescription>
          </DialogHeader>
          {approval && (
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-2 rounded-lg border border-demo/20 bg-demo-foreground px-3.5 py-3 text-xs text-demo">
                <FlaskConical className="mt-0.5 size-4 shrink-0" />
                <p>
                  This is a simulation. No customer or Slack message will be
                  sent.
                </p>
              </div>
              <dl className="space-y-2.5 text-xs">
                <div className="grid grid-cols-[90px_1fr] gap-3">
                  <dt className="text-muted-foreground">Ticket</dt>
                  <dd className="[overflow-wrap:anywhere]">
                    {ticketCode(ticket)}
                  </dd>
                </div>
                <div className="grid grid-cols-[90px_1fr] gap-3">
                  <dt className="text-muted-foreground">
                    {approval.action === "reply" ? "Customer" : "Destination"}
                  </dt>
                  <dd className="[overflow-wrap:anywhere]">
                    {approval.destination}
                  </dd>
                </div>
                <div className="grid grid-cols-[90px_1fr] gap-3">
                  <dt className="text-muted-foreground">Action</dt>
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
                <div className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed [overflow-wrap:anywhere]">
                  {approval.content}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-ink-secondary">
                  This updates the NEXUS review state. It does not close the
                  Intercom conversation or indicate that the underlying issue
                  is fixed.
                </p>
              )}
              {actionError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-xs text-destructive"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <p>
                    {actionError} You can retry this same approval safely; it
                    uses the same request ID.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeApproval}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={confirm} disabled={pending || !approval}>
              {pending ? (
                <>
                  <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  Recording…
                </>
              ) : approval?.action === "resolve" ? (
                "Confirm resolution"
              ) : approval?.action === "reply" ? (
                "Simulate reply"
              ) : (
                "Simulate escalation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
