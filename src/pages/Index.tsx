import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarCheck,
  Tablet,
  Bot,
  Users,
  BellRing,
  Sparkles,
  ArrowRight,
  UtensilsCrossed,
  ShieldCheck,
  Zap,
} from "lucide-react";
import heroImage from "@/assets/hero-restaurant.jpg";

const features = [
  {
    icon: Tablet,
    title: "Tablet-first floor mode",
    body: "Snelle, grote tap targets voor host en bediening tijdens service. Eén tik per actie.",
  },
  {
    icon: Bot,
    title: "AI-host die meedenkt",
    body: "WhatsApp, telefoon en webchat. AI checkt altijd de echte beschikbaarheid — geen dubbele boekingen.",
  },
  {
    icon: BellRing,
    title: "Minder no-shows",
    body: "Slimme reminders via WhatsApp, SMS en e-mail. Geïntegreerd met ClickWise workflows.",
  },
  {
    icon: Users,
    title: "Gastprofielen die kloppen",
    body: "Bezoekhistorie, voorkeuren, allergieën en taalvoorkeur — automatisch verrijkt.",
  },
  {
    icon: Zap,
    title: "Walk-ins in seconden",
    body: "Spontane gast? Personen, zone, plaats nu. Klaar. Zichtbaar in elk overzicht.",
  },
  {
    icon: ShieldCheck,
    title: "POS-ready architectuur",
    body: "Voorbereid op koppeling met je kassa. Omzet per gast, per tafel, per kanaal.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="container flex items-center justify-between py-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-elegant">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight text-primary-foreground drop-shadow">
              TableWise
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-primary-foreground/90 md:flex">
            <a href="#features" className="transition-smooth hover:text-primary-foreground">Functies</a>
            <a href="#voor-wie" className="transition-smooth hover:text-primary-foreground">Voor wie</a>
            <a href="#integraties" className="transition-smooth hover:text-primary-foreground">Integraties</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/auth">Inloggen</Link>
            </Button>
            <Button asChild className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
              <Link to="/reserveer">Reserveer</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={heroImage}
            alt="Sfeervolle restaurantzaal bij gouden uur met kaarslicht en gedekte tafels"
            className="h-full w-full object-cover"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/85 via-foreground/60 to-primary/50" />
        </div>

        <div className="container relative pb-24 pt-36 md:pb-32 md:pt-44 lg:pb-44 lg:pt-52">
          <div className="max-w-3xl animate-fade-in-up">
            <Badge className="mb-6 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground backdrop-blur">
              <Sparkles className="mr-1.5 h-3 w-3" />
              AI-first reserveringssysteem
            </Badge>

            <h1 className="font-display text-5xl font-semibold leading-[1.05] text-primary-foreground md:text-6xl lg:text-7xl">
              Het reserveringssysteem dat <em className="not-italic text-accent">lege tafels voorkomt</em>, gasten terugbrengt en de bediening rust geeft.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-primary-foreground/85 md:text-xl">
              TableWise brengt reserveringen, tafelbeheer, walk-ins, wachtlijst, no-show preventie, gastdata,
              ClickWise-communicatie en toekomstige POS-inzichten samen in één premium tablet-first systeem voor moderne horeca.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-primary-foreground text-primary shadow-elegant hover:bg-primary-foreground/95">
                <Link to="/reserveer">
                  Reserveer een tafel
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-primary-foreground/5 text-primary-foreground backdrop-blur hover:bg-primary-foreground/15 hover:text-primary-foreground"
              >
                <Link to="/auth">Voor restauranthouders</Link>
              </Button>
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-primary-foreground/75">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-accent" />
                <span>Realtime beschikbaarheid</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <span>Geen dubbele boekingen</span>
              </div>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent" />
                <span>WhatsApp · SMS · Voice</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gradient-warm py-20 md:py-28">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Wat het doet</span>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight md:text-5xl">
              Eén systeem voor reserveringen, tafels en gastcommunicatie.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Gebouwd voor restaurants, eetcafés, lunchrooms en strandpaviljoens die premium willen werken
              zonder enterprise-rompslomp.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group rounded-2xl border bg-gradient-card p-7 shadow-soft transition-smooth hover:-translate-y-1 hover:shadow-elegant"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-smooth group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Voor wie */}
      <section id="voor-wie" className="py-20 md:py-28">
        <div className="container grid items-center gap-14 lg:grid-cols-2">
          <div>
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Voor wie</span>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight md:text-5xl">
              Premium tools voor zaken die graag persoonlijk blijven.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Of je nu 30 of 180 couverts per service draait — TableWise schaalt mee zonder dat het
              ingewikkeld voelt voor je team.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Restaurants & bistro's",
                "Eetcafés en lunchrooms",
                "Strandpaviljoens & toeristische horeca",
                "Hotelrestaurants",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { value: "−42%", label: "Minder no-shows met slimme reminders" },
              { value: "8 sec", label: "Gemiddeld voor een walk-in" },
              { value: "24/7", label: "AI-host neemt op wanneer jij kookt" },
              { value: "100%", label: "Tablet-first ontworpen" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border bg-gradient-card p-6 shadow-soft">
                <div className="font-display text-4xl font-semibold text-primary">{s.value}</div>
                <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="bg-muted/30 py-20 md:py-28">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Waarom TableWise</span>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight md:text-5xl">
              Niet zomaar reserveringen — een hospitality operating system.
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[
              { t: "No-shows verminderen", b: "Bevestiging, reminders en herbevestiging via magic link. Plus wachtlijst-match bij annulering." },
              { t: "Tablet-first floor mode", b: "Grote knoppen, één tik per actie. Gemaakt voor de drukte van service." },
              { t: "Commissievrij", b: "Geen commissie per couvert. Je eigen kanaal, je eigen gastdata." },
              { t: "Alle kanalen samen", b: "Website, WhatsApp, QR, Google en Instagram in één dashboard." },
              { t: "Wachtlijst & last-minute opvulling", b: "Vrijgekomen tafel? Direct match met wachtende gast." },
              { t: "ClickWise CRM & workflows", b: "Bevestigingen, reviews en winback via je bestaande CRM." },
              { t: "AI-ready", b: "Voice, WhatsApp en webchat — altijd binnen jouw beschikbaarheidsregels." },
              { t: "Loyverse als starter-POS", b: "Begin gratis met Loyverse, koppel later omzet aan reserveringen." },
              { t: "Reviews & terugkomflows", b: "Tevreden gasten naar Google, ontevreden gasten naar de manager." },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border bg-card p-6 shadow-soft">
                <h3 className="font-display text-lg font-semibold">{f.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="integraties" className="pb-24">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-10 shadow-lifted md:p-16">
            <div className="relative max-w-2xl">
              <h2 className="font-display text-4xl font-semibold leading-tight text-primary-foreground md:text-5xl">
                Klaar om je service rustiger te laten verlopen?
              </h2>
              <p className="mt-4 text-lg text-primary-foreground/85">
                Begin vandaag met reserveringen aannemen. Integraties met ClickWise, WhatsApp en je
                kassa volgen wanneer jij eraan toe bent.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/95">
                  <Link to="/reserveer">
                    Reserveer een tafel
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  <Link to="/auth">Naar het dashboard</Link>
                </Button>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-10 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <span className="font-display text-base font-semibold text-foreground">TableWise</span>
          </div>
          <div>© {new Date().getFullYear()} TableWise — Premium horeca reserveringen.</div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
