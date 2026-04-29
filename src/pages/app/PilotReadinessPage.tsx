// Internal Pilot Readiness page — Prompt 21 production hardening report.
// Honest, static overview of which subsystems are pilot-ready and which are
// prepared but not yet live. Only managers/owners see commercial details.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useRestaurant } from "@/hooks/useRestaurant";
import { CheckCircle2, AlertCircle, Clock, MinusCircle } from "lucide-react";

type Status = "ready" | "attention" | "prepared" | "out_of_scope";

const STATUS_META: Record<Status, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  ready:        { label: "Klaar voor pilot",     tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  attention:    { label: "Aandacht nodig",       tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",         Icon: AlertCircle  },
  prepared:     { label: "Voorbereid, niet live",tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",                 Icon: Clock        },
  out_of_scope: { label: "Buiten scope",         tone: "bg-muted text-muted-foreground border-border",                                    Icon: MinusCircle  },
};

type Item = { name: string; status: Status; note: string };

const SECTIONS: Array<{ title: string; items: Item[] }> = [
  {
    title: "Reserveringskern",
    items: [
      { name: "Reserveringsengine",        status: "ready",     note: "Edge functions met availability + pacing + statustransities." },
      { name: "Availability check",        status: "ready",     note: "Openingstijden, shifts, special days, capaciteit en overlap." },
      { name: "Dubbele boeking preventie", status: "attention", note: "Re-check vóór insert; volledige DB-level locking (RPC) staat nog op de roadmap." },
      { name: "Statusovergangen",          status: "ready",     note: "ALLOWED_TRANSITIONS afgedwongen in manage_reservation." },
      { name: "Walk-ins",                  status: "ready",     note: "Tablet-flow ≤5s; deelt engine en blokkeert tafels correct." },
      { name: "Wachtlijstconversie",       status: "ready",     note: "Hergebruikt availability + zet converted_reservation_id éénmalig." },
    ],
  },
  {
    title: "Beveiliging & tenant-isolatie",
    items: [
      { name: "Supabase RLS",               status: "ready",     note: "Member/manager helpers + per-tabel policies; linter clean." },
      { name: "Magic link tokens",          status: "ready",     note: "UUID v4, server-side expiry check, nooit teruggegeven aan client." },
      { name: "Publieke booking widget",    status: "ready",     note: "Alleen veilige velden; availability re-check vlak vóór create." },
      { name: "Rollen & rechten (UI)",      status: "attention", note: "Owner/manager checks aanwezig; fijnmazige host/staff/viewer policies nog uit te breiden." },
      { name: "Audit logs",                 status: "ready",     note: "Trigger op statuswijziging + expliciete inserts in edge functions." },
    ],
  },
  {
    title: "Operatie (tablet-first)",
    items: [
      { name: "Floor Mode",        status: "ready", note: "Landscape & portrait; sticky actions; connection notice." },
      { name: "Tafelplan",         status: "ready", note: "Status, badges, acties per tafel." },
      { name: "Walk-in flow",      status: "ready", note: "Snelle invoer met zone- en tafeladvies." },
      { name: "No-show preventie", status: "ready", note: "Bevestiging + confirmation dialog; geen stigma-labels." },
      { name: "Pre-orders",        status: "ready", note: "Voorbereiden, klaarzetten, geen betaalclaim." },
    ],
  },
  {
    title: "Voorbereide integraties (nog niet live)",
    items: [
      { name: "ClickWise",  status: "prepared", note: "Mapping, queue en payload preview klaar; geen externe verzending." },
      { name: "WhatsApp / SMS / E-mail",status: "prepared", note: "Templates en triggers voorbereid; verzending niet actief." },
      { name: "AI Host actions",        status: "prepared", note: "Action catalog en dispatcher; geen publieke endpoint zonder beveiliging." },
      { name: "Loyverse POS",           status: "prepared", note: "Demo/handmatige bonnen en matching; geen live API-call." },
      { name: "Andere POS-systemen",    status: "prepared", note: "Provider-agnostisch datamodel; later via API/import/webhook." },
      { name: "Aanbetalingen",          status: "prepared", note: "Status-velden + microcopy; geen payment provider gekoppeld." },
      { name: "Google Review routing",  status: "prepared", note: "URL en uitnodiging klaar; geen automatische verzending." },
    ],
  },
  {
    title: "Inzicht & rapportage",
    items: [
      { name: "Rapportages",        status: "ready",     note: "KPI-cards + insights; rolbewuste omzetweergave." },
      { name: "Data health checks", status: "attention", note: "Eenvoudige consistency rules in services; geen automatische dashboard-job." },
      { name: "Echte load test",    status: "out_of_scope", note: "Volgt in stabilisatiefase met pilot-restaurant." },
    ],
  },
];

const NEXT_STEPS = [
  "Prompt 22 — ClickWise Live Integration (eerst sandbox, dan stapsgewijs live).",
  "Pilot Restaurant Setup — één locatie, gecontroleerde data, dagelijkse review.",
  "Stabilization & Launch Readiness — DB-level RPC voor transactionele tafeltoewijzing.",
];

export default function PilotReadinessPage() {
  const { current } = useRestaurant();
  const isManager = current?.role === "owner" || current?.role === "manager";

  return (
    <div className="container max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-display">Pilot readiness</h1>
        <p className="text-sm text-muted-foreground">
          Eerlijk overzicht van wat productie-klaar is voor een eerste pilot en wat nog
          voorbereid maar niet live is. Bedoeld als interne werkkaart, niet als verkoopdocument.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-lg">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {section.items.map((item) => {
              const meta = STATUS_META[item.status];
              const Icon = meta.Icon;
              return (
                <div key={item.name} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <Icon className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{item.name}</span>
                      <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.note}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Aanbevolen volgende stappen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              {NEXT_STEPS.map((s) => <li key={s}>{s}</li>)}
            </ol>
            <Separator className="my-3" />
            <p className="text-xs text-muted-foreground">
              Deze MVP is een serieuze, pilotwaardige basis — nog geen brede commerciële uitrol.
              Externe verzending (WhatsApp, SMS, e-mail), live POS en betalingen worden bewust
              niet geactiveerd zonder veilige backend-configuratie.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
