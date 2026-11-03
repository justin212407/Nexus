import React from "react";
import { Clock, Info, ShieldAlert } from "lucide-react";
import { evidenceSources, ROOT_CAUSES, ticketCode } from "../lib/workspace";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function Section({ title, children }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2.5 text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

export default function EvidencePanel({ ticket, onClose }) {
  const b = ticket.brief;
  const sources = evidenceSources(b);
  const confidence = Number(b.confidence_pct);
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {ticketCode(ticket)} · Technical brief
          </p>
          <SheetTitle className="text-lg tracking-tight">
            {ROOT_CAUSES[b.root_cause] || "Undetermined"}
          </SheetTitle>
          <SheetDescription className="text-sm leading-relaxed text-ink-secondary">
            {b.engineer_summary}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-8">
          <div className="my-5 space-y-2.5 border-y py-4 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Service</span>
              <strong className="font-medium">
                {b.affected_service || "Not provided"}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">
                Reported users affected
              </span>
              <strong className="font-medium">
                {b.affected_users ?? "Not provided"}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Model confidence</span>
              <strong className="font-medium">
                {Number.isFinite(confidence) &&
                confidence >= 0 &&
                confidence <= 100
                  ? `${confidence}%`
                  : "Unavailable"}
              </strong>
            </div>
            {b.linear_issue_id && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  Related Linear issue
                </span>
                <strong className="font-mono text-xs font-medium">
                  {b.linear_issue_id}
                </strong>
              </div>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Confidence is the model’s assessment, not a measure of verified
            accuracy. Source records are not included in this brief.
          </p>

          <Section
            title={
              <span className="flex items-center gap-2">
                Sources referenced
                <Badge variant="secondary" className="px-1.5 text-[11px]">
                  {sources.length}
                </Badge>
              </span>
            }
          >
            {sources.length ? (
              <div>
                {sources.map((source) => (
                  <div
                    key={source}
                    className="flex items-center gap-3 border-b py-2.5 last:border-b-0"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-muted text-xs font-semibold text-ink-secondary">
                      {source.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{source}</p>
                      <p className="text-xs text-muted-foreground">
                        Referenced in generated analysis
                      </p>
                    </div>
                    <Info className="size-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-foreground px-3.5 py-3 text-xs text-warning">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <p>
                  No matching signals were referenced. This does not establish
                  that every system is healthy.
                </p>
              </div>
            )}
          </Section>

          <Section title="Analysis narrative">
            <ol className="space-y-3.5">
              {(b.causal_chain || []).map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[11px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-xs leading-relaxed text-ink-secondary">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              Generated explanation. The sequence may include inferred
              relationships.
            </p>
          </Section>

          <Section title="Recommended next step">
            <p className="text-xs leading-relaxed text-ink-secondary">
              {b.recommended_action || "No recommendation provided."}
            </p>
          </Section>

          {b.resolution_eta && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border bg-muted/40 px-3.5 py-3 text-xs text-ink-secondary">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p>
                Suggested ETA: {b.resolution_eta}. Verify before communicating
                it.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
