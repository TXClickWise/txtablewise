import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Trial",
    price: "Gratis",
    period: "14 dagen",
    description: "Probeer alles uit. Geen creditcard nodig.",
    features: [
      "Onbeperkt reserveringen tijdens trial",
      "Tafelplan en vloerbeheer",
      "Walk-ins en wachtlijst",
      "E-mail support",
    ],
    ctaLabel: "Start gratis trial",
    ctaTo: "/auth",
    highlight: false,
  },
  {
    name: "Basic",
    price: "Op aanvraag",
    period: "per maand",
    description: "Alles voor de dagelijkse vloer.",
    features: [
      "Onbeperkt reserveringen",
      "Tafelplan met zones",
      "Walk-ins en wachtlijst",
      "No-show preventie met reminders",
      "Gastprofielen",
      "WhatsApp-bevestigingen",
      "E-mail support",
    ],
    ctaLabel: "Plan een demo",
    ctaHref: "#contact",
    highlight: false,
  },
  {
    name: "Pro",
    price: "Op aanvraag",
    period: "per maand",
    description: "Volledige automatisering en multi-locatie.",
    features: [
      "Alles van Basic",
      "AI-host: telefoon, WhatsApp en webchat",
      "Automatische herbevestiging en risicoscores",
      "Wachtlijst met automatische matching",
      "Rapportages en inzichten",
      "Eigen widget-domein (white-label)",
      "Prioriteit support en onboarding",
      "Toekomstige POS-integratie inbegrepen",
    ],
    ctaLabel: "Plan een demo",
    ctaHref: "#contact",
    highlight: true,
    badge: "Aanbevolen",
  },
];

export function PricingSection() {
  return (
    <section id="tarieven" className="py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Tarieven
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-5xl">
            Eenvoudig en eerlijk.
          </h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Transparante maandprijzen, geen commissie per couvert, maandelijks opzegbaar.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {tiers.map((t) => {
            const isPro = t.highlight;
            return (
              <div
                key={t.name}
                className={cn(
                  "relative flex flex-col rounded-2xl p-7 transition-all duration-300",
                  isPro
                    ? "bg-gradient-hero text-primary-foreground shadow-glow-gold lg:scale-[1.03] border border-accent/30"
                    : t.name === "Trial"
                      ? "bg-card border border-border"
                      : "bg-card border border-border shadow-soft hover:-translate-y-1 hover:shadow-elevated",
                )}
              >
                {t.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-foreground shadow-glow-gold">
                    {t.badge}
                  </span>
                )}
                <h3 className={cn("font-display text-2xl font-bold", isPro && "text-primary-foreground")}>{t.name}</h3>
                <p className={cn("mt-1 text-sm", isPro ? "text-primary-foreground/70" : "text-muted-foreground")}>{t.description}</p>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className={cn("font-display text-4xl font-bold", isPro ? "text-primary-foreground" : "text-foreground")}>
                    {t.price}
                  </span>
                  <span className={cn("text-sm", isPro ? "text-primary-foreground/85" : "text-muted-foreground")}>{t.period}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {t.features.map((f) => (
                    <li key={f} className={cn("flex items-start gap-2.5 text-sm", isPro ? "text-primary-foreground/90" : "text-foreground/85")}>
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", isPro ? "text-accent" : "text-primary")} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  {t.ctaTo ? (
                    <Button asChild size="lg" className="h-12 w-full text-base" variant={isPro ? "default" : "outline"}>
                      <Link to={t.ctaTo}>{t.ctaLabel}</Link>
                    </Button>
                  ) : (
                    <Button asChild size="lg" className="h-12 w-full text-base" variant={isPro ? "default" : "outline"}>
                      <a href={t.ctaHref}>{t.ctaLabel}</a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
