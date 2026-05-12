import {
  Wallet,
  Sparkles,
  LayoutDashboard,
  Hand,
  ShieldCheck,
  Lock,
} from "lucide-react";

const usps = [
  {
    icon: Wallet,
    title: "Geen commissie. Nooit.",
    body: "Bij sommige systemen betaal je tot €2 per couvert — dat kan oplopen tot honderden euro's per maand. Bij TX TableWise betaal je een vaste maandprijs. Wat jouw tafels opbrengen, blijft van jou.",
  },
  {
    icon: Sparkles,
    title: "AI die écht reserveert",
    body: "Niet een chatbot die doorverwijst naar een formulier. Onze AI-host controleert de werkelijke beschikbaarheid, boekt de juiste tafel en bevestigt — ook om 2 uur 's nachts.",
  },
  {
    icon: LayoutDashboard,
    title: "Eén dashboard voor alles",
    body: "Telefoon, WhatsApp, website, walk-in, Instagram — bij de meeste systemen raak je het overzicht kwijt. TX TableWise brengt elk kanaal samen in één scherm.",
  },
  {
    icon: Hand,
    title: "Gemaakt voor de vloer",
    body: "Geen ingewikkelde menu's. Grote knoppen, één tik per actie. Ontworpen voor een host die met één hand een tablet vasthoudt terwijl de zaak volloopt.",
  },
  {
    icon: ShieldCheck,
    title: "Slimme no-show preventie",
    body: "Niet alleen een herinnering sturen. TX TableWise combineert automatische bevestiging, herbevestiging via WhatsApp, risicoscores per gast en aanbetalingen alleen wanneer het echt nodig is.",
  },
  {
    icon: Lock,
    title: "Jouw gasten, jouw data",
    body: "Geen extern platform dat jouw gastrelaties beheert. Geen marktplaats die jouw gasten naar de concurrent stuurt. Jouw gastdata is van jou — altijd.",
  },
];

export function WhyTableWiseSection() {
  return (
    <section className="bg-muted/30 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Waarom TX TableWise
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-5xl">
            Wat maakt TX TableWise anders?
          </h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Gebouwd met alles wat we misten bij bestaande systemen.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {usps.map((u) => (
            <article key={u.title} className="usp-card relative overflow-hidden pl-8">
              <span className="absolute inset-y-5 left-0 w-1 rounded-r-full bg-gradient-to-b from-accent to-primary" />
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <u.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">
                {u.title}
              </h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{u.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
