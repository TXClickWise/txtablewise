// Kleine herbruikbare rapportagecomponenten.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Info, Lightbulb, AlertTriangle, CheckCircle2, Download } from "lucide-react";

export function DataStatusBadge({ kind }: { kind: "live" | "demo" | "prepared" | "incomplete" | "clickwise_ready" }) {
  const map = {
    live:             { label: "Live data", variant: "default" as const },
    demo:             { label: "Demo / handmatige data", variant: "secondary" as const },
    prepared:         { label: "Voorbereid", variant: "outline" as const },
    incomplete:       { label: "Onvolledig", variant: "outline" as const },
    clickwise_ready:  { label: "ClickWise-ready", variant: "secondary" as const },
  } as const;
  const cfg = map[kind];
  return <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>;
}

export function ReportKpiCard({
  label, value, hint, status, valueClassName,
}: { label: string; value: string | number; hint?: string; status?: Parameters<typeof DataStatusBadge>[0]["kind"]; valueClassName?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs text-muted-foreground">{label}</div>
          {status && <DataStatusBadge kind={status} />}
        </div>
        <div className={cn("font-display text-3xl mt-1", valueClassName)}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function ReportSection({
  title, description, status, children, action,
}: { title: string; description?: string; status?: Parameters<typeof DataStatusBadge>[0]["kind"]; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl">{title}</h2>
            {status && <DataStatusBadge kind={status} />}
          </div>
          {description && <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function InsightCardItem({ title, body, tone }: { title: string; body: string; tone: "info" | "positive" | "warning" }) {
  const Icon = tone === "warning" ? AlertTriangle : tone === "positive" ? CheckCircle2 : Lightbulb;
  const toneCls = tone === "warning" ? "border-warning/30 bg-warning/5"
    : tone === "positive" ? "border-primary/30 bg-primary/5"
    : "border-border bg-muted/30";
  return (
    <Card className={cn("border", toneCls)}>
      <CardContent className="p-4 flex gap-3">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{body}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, message, cta }: { title: string; message: string; cta?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6 text-center space-y-2">
        <Info className="h-5 w-5 mx-auto text-muted-foreground" />
        <div className="font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{message}</p>
        {cta && <div className="pt-2">{cta}</div>}
      </CardContent>
    </Card>
  );
}

export function ExportReadyButton({ label = "Exporteren" }: { label?: string }) {
  return (
    <Button size="sm" variant="outline" disabled title="Binnenkort beschikbaar">
      <Download className="h-3.5 w-3.5 mr-1" /> {label} <span className="ml-1 text-[10px] text-muted-foreground">Binnenkort</span>
    </Button>
  );
}

export function StatusDistributionList({ data }: { data: Record<string, number> }) {
  const labels: Record<string, string> = {
    pending: "Wachtend", confirmed: "Bevestigd", seated: "Aan tafel",
    completed: "Voltooid", finished: "Voltooid", cancelled: "Geannuleerd", no_show: "No-show", hold: "Hold",
  };
  const total = Object.values(data).reduce((s, n) => s + n, 0);
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (total === 0) return <p className="text-sm text-muted-foreground">Nog geen reserveringen in deze periode.</p>;
  return (
    <ul className="space-y-1.5">
      {entries.map(([key, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <li key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{labels[key] ?? key}</span>
              <span className="text-muted-foreground">{count} · {pct}%</span>
            </div>
            <div className="h-1.5 rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SimpleBarChart({ data, valueKey = "value", labelKey = "label", max }: {
  data: Array<Record<string, string | number>>; valueKey?: string; labelKey?: string; max?: number;
}) {
  if (!data.length) return <p className="text-sm text-muted-foreground">Geen data.</p>;
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const m = max ?? Math.max(...values, 1);
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const pct = (v / m) * 100;
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-muted-foreground truncate">{String(d[labelKey])}</span>
            <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right tabular-nums">{v}</span>
          </div>
        );
      })}
    </div>
  );
}
