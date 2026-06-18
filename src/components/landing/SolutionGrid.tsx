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
    title: "Alle reserveringen op één plek",
    body: "Of een gast nu via je website, telefoon, WhatsApp of binnenloopt — alles komt overzichtelijk samen. Geen briefjes meer, geen dubbele boekingen.",
  },
  {
    icon: Tablet,
    title: "Eén tablet voor de hele service",
    body: "Grote knoppen, duidelijke kleuren, in één tik een tafel verzetten of afsluiten. Zelfs op het drukste moment van de avond houd je overzicht.",
  },
  {
    icon: BellRing,
    title: "Minder lege tafels door no-shows",
    body: "Gasten krijgen automatisch een bevestiging en een vriendelijke herinnering. Bij grote groepen of risicogasten: een nette vraag om een kleine aanbetaling.",
  },
  {
    icon: ListChecks,
    title: "Wachtlijst die zichzelf invult",
    body: "Wordt er last-minute afgezegd? TX TableWise nodigt automatisch de eerstvolgende gast op de wachtlijst uit. Lege plekken worden weer volle tafels.",
  },
  {
    icon: Users,
    title: "Je gasten écht kennen",
    body: "Allergieën, lievelingstafel, eerdere bezoeken, jubileum — alles bij de hand. Zo verras je gasten zonder dat je het hoeft te onthouden.",
  },
  {
    icon: PhoneCall,
    title: "AI-gastvrouw aan de telefoon",
    body: "Belt iemand om elf uur 's avonds voor morgen? De AI-gastvrouw neemt op, checkt of er plek is, boekt de tafel en stuurt de bevestiging. Met je eigen telefoonnummer.",
  },
];

export function SolutionGrid() {
  return (
    <section id="functies" className="py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            De oplossing
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-5xl">
            Eén systeem. Heel je service op orde.
          </h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Geen losse tools meer. Geen dubbele boekingen. Geen kladblok aan de bar.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="usp-card group">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-all duration-300 group-hover:bg-accent group-hover:text-accent-foreground group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
