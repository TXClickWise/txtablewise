import {
  Wallet,
  Sparkles,
  LayoutDashboard,
  Hand,
  ShieldCheck,
  Lock,
  Users,
} from "lucide-react";
import { RevealOnScroll } from "./RevealOnScroll";

const usps = [
  {
    icon: Wallet,
    title: "Geen euro commissie per gast",
    body: "Bij sommige platforms betaal je tot €2 per couvert — al snel honderden euro's per maand. Bij TX TableWise betaal je één vaste maandprijs. Wat jouw tafels opbrengen, blijft van jou.",
  },
  {
    icon: Sparkles,
    title: "Een AI-gastvrouw die écht boekt",
    body: "Geen chatbot die mensen wegstuurt naar een formulier. Onze AI-gastvrouw kijkt of er plek is, kiest de juiste tafel en stuurt netjes de bevestiging — ook om twee uur 's nachts.",
  },
  {
    icon: LayoutDashboard,
    title: "Eén overzicht voor alles",
    body: "Telefoon, WhatsApp, website, walk-in, Instagram — bij de meeste systemen verlies je het overzicht. TX TableWise brengt alle gasten samen in één scherm.",
  },
  {
    icon: Users,
    title: "Grote groepen, slim geregeld",
    body: "Vanaf het aantal gasten dat jij kiest, gaat TX TableWise extra opletten: het systeem vraagt netjes om jouw goedkeuring en stelt automatisch een passende aanbetaling voor. Geen verrassingen meer met een tafel voor zestien die eigenlijk nooit had gepast.",
  },
  {
    icon: Hand,
    title: "Gemaakt voor op de vloer",
    body: "Geen ingewikkelde menu's. Grote knoppen, één tik per actie. Ontworpen voor een gastvrouw die de tablet in één hand vasthoudt terwijl de zaak vol begint te lopen.",
  },
  {
    icon: ShieldCheck,
    title: "Eerlijke no-show preventie",
    body: "Vriendelijke bevestiging, slimme herinnering, herbevestiging via WhatsApp en — alleen wanneer nodig — een nette vraag om een aanbetaling. Zonder je gasten af te schrikken.",
  },
  {
    icon: Lock,
    title: "Jouw gasten, jouw relatie",
    body: "Geen platform dat tussen jou en je gast staat. Geen marktplaats die jouw vaste gast morgen naar de concurrent stuurt. Je gastenboek is en blijft van jou.",
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
            Gebouwd met alles wat we misten bij bestaande systemen — vanuit de horeca zelf.
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
