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
      "Reserveringen, tafelplan, walk-ins",
      "Tot 50 reserveringen",
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
      "Wachtlijst & no-show preventie",
      "Gastprofielen & basis CRM",
      "WhatsApp-bevestigingen",
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
      "AI-host (telefoon, WhatsApp, webchat)",
      "Rapportages & exports",
      "Eigen widget-domein",
      "Prioriteit support",
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
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Tarieven
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-5xl">
            Eenvoudig en eerlijk.
          </h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Transparante maandprijzen, geen commissie per couvert, maandelijks opzegbaar.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-7 shadow-soft transition-smooth",
                t.highlight && "border-primary/40 shadow-elegant lg:scale-[1.03]",
              )}
            >
              {t.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                  {t.badge}
                </span>
              )}
              <h3 className="font-display text-2xl font-semibold">{t.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold text-foreground">
                  {t.price}
                </span>
                <span className="text-sm text-muted-foreground">{t.period}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/85">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                {t.ctaTo ? (
                  <Button asChild size="lg" className="h-12 w-full text-base" variant={t.highlight ? "default" : "outline"}>
                    <Link to={t.ctaTo}>{t.ctaLabel}</Link>
                  </Button>
                ) : (
                  <Button asChild size="lg" className="h-12 w-full text-base" variant={t.highlight ? "default" : "outline"}>
                    <a href={t.ctaHref}>{t.ctaLabel}</a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
