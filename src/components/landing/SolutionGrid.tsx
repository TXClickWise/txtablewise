import {
  CalendarCheck,
  Tablet,
  BellRing,
  Users,
  PhoneCall,
  ListChecks,
} from "lucide-react";

const features = [
  {
    icon: CalendarCheck,
    title: "Reserveringen",
    body: "Online, telefoon, WhatsApp, walk-in en AI — elk kanaal direct in je dashboard. Nooit meer dubbel boeken.",
  },
  {
    icon: Tablet,
    title: "Tafelplan op tablet",
    body: "Grote knoppen, kleurcodes, één tik per actie. Zie in een oogopslag welke tafel vrij is, wie bijna klaar is en waar de walk-in kan zitten.",
  },
  {
    icon: BellRing,
    title: "No-show preventie",
    body: "Automatische bevestiging, herinnering 24 uur van tevoren, herbevestiging via WhatsApp. Bij risicogasten of grote groepen: een vriendelijke aanbetaling.",
  },
  {
    icon: ListChecks,
    title: "Wachtlijst",
    body: "Annulering? Het systeem matcht automatisch met wachtende gasten en stuurt een uitnodiging. Lege tafels worden weer volle tafels.",
  },
  {
    icon: Users,
    title: "Gastprofielen",
    body: "Weet bij elk bezoek wie er komt. Allergieën, tafelvoorkeuren, VIP-status, bezoekhistorie — automatisch opgebouwd, altijd bij de hand.",
  },
  {
    icon: PhoneCall,
    title: "AI-host",
    body: "Gast belt om 23:00 voor een tafel morgenavond? De AI-host neemt op, checkt beschikbaarheid, boekt de tafel en stuurt de bevestiging. Jij slaapt.",
  },
];

export function SolutionGrid() {
  return (
    <section id="functies" className="py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            De oplossing
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-5xl">
            Eén systeem, alles op orde.
          </h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Geen losse tools meer. Geen dubbele boekingen. Geen briefjes meer aan de bar.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border bg-gradient-card p-6 shadow-soft transition-smooth hover:-translate-y-1 hover:shadow-elegant"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-smooth group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
