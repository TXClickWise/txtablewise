import { Check } from "lucide-react";

const points = [
  {
    title: "Nederlands systeem, Nederlandse support",
    body: "Gebouwd in Nederland, in dialoog met horecaondernemers. Korte lijntjes als er iets is.",
  },
  {
    title: "Geen commissie, geen verborgen kosten",
    body: "Eén transparante maandprijs. Wat je tafels opbrengen, blijft van jou.",
  },
  {
    title: "Jij bent eigenaar van je gastdata",
    body: "Geen externe marktplaats die meekijkt. Jouw gasten, jouw relaties.",
  },
  {
    title: "Direct live, geen lange implementatie",
    body: "In 15 minuten ingericht. We helpen je persoonlijk bij de eerste service.",
  },
  {
    title: "Geen marketplace, geen vergelijkingssite",
    body: "TX TableWise stuurt jouw gasten niet naar de concurrent. Het is jouw systeem, op jouw website, onder jouw naam.",
  },
  {
    title: "Groeit mee met je zaak",
    body: "Start simpel met reserveringen. Voeg later AI, wachtlijst, gastprofielen en rapportages toe wanneer jij er klaar voor bent.",
  },
];

const demoRows = [
  { time: "18:30", name: "Familie de Vries", party: 4, status: "Bevestigd" },
  { time: "19:00", name: "Janssen", party: 2, status: "Onderweg" },
  { time: "19:15", name: "Bedrijfsdiner Acme", party: 8, status: "Aanbetaald" },
  { time: "19:45", name: "Walk-in", party: 3, status: "Aan tafel 7" },
  { time: "20:00", name: "Verjaardag Lotte", party: 6, status: "Bevestigd" },
];

export function TrustSection() {
  return (
    <section className="bg-gradient-warm py-20 md:py-28">
      <div className="container grid items-center gap-14 lg:grid-cols-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Gebouwd voor Nederlandse horeca
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-5xl">
            Premium tools, zonder de enterprise-rompslomp.
          </h2>
          <ul className="mt-8 space-y-5">
            {points.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Check className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-semibold text-foreground">{p.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{p.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Dashboard mockup */}
        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-hero opacity-30 blur-3xl" />
          <div className="relative product-screenshot bg-card">
            <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              </div>
              <div className="text-xs font-medium text-muted-foreground">
                Vandaag · 23 reserveringen
              </div>
            </div>
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold">Vanavond</h3>
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                  92% bezet
                </span>
              </div>
              <div className="space-y-2">
                {demoRows.map((r) => (
                  <div
                    key={r.time + r.name}
                    className="flex items-center justify-between rounded-lg border bg-background/60 px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-medium text-foreground">{r.time}</span>
                      <span className="text-foreground/90">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{r.party} pers.</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
