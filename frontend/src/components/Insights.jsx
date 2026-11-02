import React from "react";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Clock, Info, Server, ShieldCheck } from "lucide-react";
import {
  ROOT_CAUSES,
  reviewState,
  relativeTime,
} from "../lib/workspace";
import NumberTicker from "./motion/NumberTicker";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];
const SEVERITY_COLORS = {
  critical: "#d44941",
  high: "#dbac61",
  medium: "#8a9bb5",
  low: "#5d83dd",
};

function CountLabel({ x, y, width, height, value }) {
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      dy={4}
      fontSize={12}
      fill="var(--ink-secondary)"
    >
      {value ?? 0}
    </text>
  );
}

function StatCard({ label, value, hint, icon: IconComponent }) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="px-5">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{label}</span>
          <IconComponent className="size-4 opacity-70" />
        </div>
        <p className="mt-2 text-3xl font-medium tracking-tight tabular-nums">
          <NumberTicker value={value} />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

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
  const severities = SEVERITY_ORDER.map((level) => ({
    key: level,
    label: level.charAt(0).toUpperCase() + level.slice(1),
    count: analyzed.filter((t) => t.brief.severity === level).length,
  }));

  const serviceMap = new Map();
  for (const ticket of analyzed) {
    const service = ticket.brief.affected_service || "Unspecified";
    const current = serviceMap.get(service) || { count: 0, critical: 0 };
    current.count++;
    if (ticket.brief.severity === "critical") current.critical++;
    serviceMap.set(service, current);
  }
  const services = [...serviceMap.entries()].sort((a, b) => b[1].count - a[1].count);

  const causeConfig = { count: { label: "Tickets", color: "var(--chart-1)" } };
  const severityConfig = Object.fromEntries(
    severities.map(({ key }) => [key, { label: key, color: SEVERITY_COLORS[key] }]),
  );

  return (
    <main className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl px-8 py-9 max-md:px-5">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Workspace overview
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Insights</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Understand the work coming in. Know where to focus next.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 bg-card py-1.5 text-xs font-normal text-ink-secondary">
            <Clock className="size-3.5" />
            {mode === "demo" ? "Demo" : mode === "live" ? "Live" : "Mode unavailable"} · Loaded history
          </Badge>
        </header>

        <section className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <StatCard
            label="Analysed tickets"
            value={analyzed.length}
            hint="Saved technical briefs"
            icon={ShieldCheck}
          />
          <StatCard
            label="Awaiting review"
            value={review}
            hint="Ready for a human decision"
            icon={Info}
          />
          <StatCard
            label="Escalated"
            value={escalated}
            hint="Tickets with a recorded simulation"
            icon={Server}
          />
          <StatCard
            label="Resolved in NEXUS"
            value={resolved}
            hint="Workspace resolution only"
            icon={ShieldCheck}
          />
        </section>

        {!analyzed.length && (
          <Card className="mt-5 flex flex-row items-start gap-3 border-dashed px-5 py-4 text-sm text-ink-secondary">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p>
              There are no analysed tickets in this environment yet. Counts and
              breakdowns will appear as tickets are added.
            </p>
          </Card>
        )}

        <section className="mt-5 grid grid-cols-2 gap-5 max-lg:grid-cols-1">
          <Card>
            <CardHeader className="px-5 pt-5">
              <CardTitle className="text-sm">What’s behind the tickets</CardTitle>
              <CardDescription className="text-xs">
                Generated classifications across {analyzed.length} tickets
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ChartContainer config={causeConfig} className="h-[240px] w-full">
                <BarChart
                  data={causes}
                  layout="vertical"
                  margin={{ left: 4, right: 24, top: 4, bottom: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={168}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--ink-secondary)" }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={4} fill="var(--color-count)" barSize={18} minPointSize={2}>
                    {causes.map((c) => (
                      <Cell key={c.key} fill="var(--chart-1)" />
                    ))}
                    <LabelList dataKey="count" content={<CountLabel />} />
                  </Bar>
                </BarChart>
              </ChartContainer>
              <p className="mt-3 text-xs text-muted-foreground">
                Classifications are model assessments. Review the evidence before acting.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-5 pt-5">
              <CardTitle className="text-sm">Priority distribution</CardTitle>
              <CardDescription className="text-xs">
                Severity reported in each technical brief
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ChartContainer config={severityConfig} className="h-[240px] w-full">
                <BarChart
                  data={severities}
                  layout="vertical"
                  margin={{ left: 4, right: 24, top: 4, bottom: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={84}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--ink-secondary)" }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={4} barSize={18} minPointSize={2}>
                    {severities.map((s) => (
                      <Cell key={s.key} fill={SEVERITY_COLORS[s.key]} />
                    ))}
                    <LabelList dataKey="count" content={<CountLabel />} />
                  </Bar>
                </BarChart>
              </ChartContainer>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <p>
                  Priority helps you triage. Sending a reply or escalating does
                  not automatically resolve a ticket.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="mt-5">
          <CardHeader className="px-5 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm">Services in focus</CardTitle>
                <CardDescription className="text-xs">
                  Ticket volume by affected service
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                {services.length} services
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="w-20 text-right">Tickets</TableHead>
                  <TableHead className="w-20 text-right">Critical</TableHead>
                  <TableHead className="w-48">Share of tickets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map(([service, { count, critical }]) => (
                  <TableRow key={service}>
                    <TableCell className="font-medium">{service}</TableCell>
                    <TableCell className="text-right tabular-nums">{count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {critical || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-chart-1 transition-[width] duration-300"
                            style={{
                              width: `${analyzed.length ? (count / analyzed.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {analyzed.length
                            ? Math.round((count / analyzed.length) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!services.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      No services have been recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <footer className="mt-5 flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Based on {analyzed.length} unique{" "}
            {mode === "demo" ? "demo" : mode === "live" ? "live" : "current-environment"}{" "}
            tickets in the loaded history (up to 100 records). Imported history is excluded.
          </span>
          <span>Refreshed {relativeTime(updatedAt)}</span>
        </footer>
      </div>
    </main>
  );
}
