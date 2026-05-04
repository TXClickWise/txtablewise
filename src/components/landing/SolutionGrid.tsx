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
    body: "Online, telefoon, WhatsApp, walk-in — alles in één overzicht.",
  },
  {
    icon: Tablet,
    title: "Tafelplan op tablet",
    body: "Sleep, tik, zet om. Gemaakt voor de vloer, niet voor achter een bureau.",
  },
  {
    icon: BellRing,
    title: "No-show preventie",
    body: "Automatische bevestigingen en herinneringen via WhatsApp en SMS.",
  },
  {
    icon: ListChecks,
    title: "Wachtlijst",
    body: "Annulering? De volgende gast krijgt direct bericht.",
  },
  {
    icon: Users,
    title: "Gastprofielen",
    body: "Allergieën, voorkeuren, bezoekhistorie — zonder dat je het hoeft te onthouden.",
  },
  {
    icon: PhoneCall,
    title: "AI-host",
    body: "Gasten bellen buiten openingstijd? De AI neemt op en boekt correct.",
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
