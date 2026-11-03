import React from "react";
import {
  ArrowRight,
  Code2,
  CreditCard,
  FlaskConical,
  Inbox,
  Info,
  Lock,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SCENARIO_ICONS = { code: Code2, lock: Lock, card: CreditCard };
const SEVERITY_BADGE = {
  critical: "border-destructive/25 bg-destructive/10 text-destructive",
  high: "border-warning/25 bg-warning-foreground text-warning",
  medium: "border-border bg-muted text-ink-secondary",
  low: "border-border bg-muted text-ink-secondary",
};

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
    <main className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl px-8 py-9 max-md:px-5">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b pb-7">
          <div>
            <Badge
              variant="outline"
              className="gap-1.5 bg-demo-foreground text-demo"
            >
              <FlaskConical className="size-3.5" />
              Demo lab
            </Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Make yourself at home.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              Six sample tickets. Three investigation paths.
              <br />
              Explore the complete review workflow in a safe workspace.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 max-md:items-start">
            <Button
              size="lg"
              disabled={!available || !!loading}
              onClick={() => onLoad("all")}
            >
              {loading === "all" ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
              ) : (
                <Inbox />
              )}
              Load sample workspace
              <ArrowRight />
            </Button>
            <span className="text-xs text-muted-foreground">
              Existing samples and your work are preserved.
            </span>
          </div>
        </div>

        {!available && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-foreground px-3.5 py-3 text-xs text-warning">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              {mode
                ? "This backend is in live mode. Demo samples are unavailable."
                : "Waiting for the backend to confirm the workspace environment."}
            </p>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-xs text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-1">
          {scenarios.map((s) => {
            const ScenarioIcon = SCENARIO_ICONS[s.icon] || Code2;
            return (
              <Card key={s.key} className="flex flex-col">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <span className="grid size-11 place-items-center rounded-xl border bg-muted/60 text-ink-secondary">
                    <ScenarioIcon className="size-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.number}
                  </span>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase ${SEVERITY_BADGE[s.severity] || ""}`}
                    >
                      {s.severity}
                    </Badge>
                  </div>
                  <CardDescription className="mt-2 text-xs font-medium text-foreground">
                    {s.headline}
                  </CardDescription>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.sources.map((source) => (
                      <span
                        key={source}
                        className="rounded-md bg-muted px-1.5 py-1 text-[11px] text-ink-secondary"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="mt-5 w-full justify-between"
                    onClick={() => onLoad(s.key)}
                    disabled={!available || !!loading}
                  >
                    <span className="flex items-center gap-2">
                      {loading === s.key && (
                        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                      )}
                      Open scenario
                    </span>
                    <ArrowRight />
                  </Button>
                  <span className="mt-2 self-center text-xs text-muted-foreground">
                    2 fictional customer tickets
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <section className="mt-9 grid grid-cols-[1fr_1.2fr] gap-10 border-t py-7 max-lg:grid-cols-1 max-lg:gap-6">
          <div>
            <ShieldCheck className="mb-3 size-5 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">
              A real flow. A safe place to try it.
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Every sample is clearly labeled. Every outbound action is a
              simulation.
            </p>
          </div>
          <ol className="space-y-4">
            {[
              [
                "Investigate",
                "Read the customer’s message and inspect the analysis.",
              ],
              [
                "Make it yours",
                "Edit the suggested response. Your draft stays with its ticket.",
              ],
              [
                "Review and confirm",
                "Check the exact message and destination before recording an action.",
              ],
            ].map(([title, copy], i) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs text-muted-foreground">
                  {i + 1}
                </span>
                <div>
                  <strong className="text-xs font-medium">{title}</strong>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {copy}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
