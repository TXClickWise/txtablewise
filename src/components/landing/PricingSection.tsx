import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Phone, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Trial",
    price: "Gratis",
    priceSuffix: "",
    period: "14 dagen volledige toegang",
    description: "Probeer alles uit. Geen creditcard nodig.",
    features: [
      "Tot 50 reserveringen tijdens trial",
      "Tafelplan, zones en Floor mode",
      "Walk-ins en wachtlijst",
      "Bevestigingen en reminders per e-mail",
      "Gastprofielen (CRM-basis)",
      "Basis-rapportages",
    ],
    ctaLabel: "Start gratis trial",
    ctaTo: "/auth?mode=signup",
    highlight: false,
  },
  {
    name: "Basic",
    price: "€49",
    priceSuffix: "/maand",
    period: "excl. 21% btw",
    description: "Alles wat je dagelijks nodig hebt om de vloer rustig te runnen.",
    features: [
      "Onbeperkt reserveringen",
      "Tafelplan met zones, combinaties en vul-strategie",
      "Walk-ins, wachtlijst en grote groepen",
      "No-show preventie: bevestiging + 24u-reminder + herbevestiging",
      "Gastprofielen, allergieën, VIP-tags",
      "Reviews & aftercare (na bezoek)",
      "Weer-inzichten en stille AI-tips",
      "POS-koppeling (Loyverse) — basis",
      "E-mail support",
    ],
    addon: "WhatsApp, SMS en AI-telefonie vereisen de ClickWise add-on (zie hieronder).",
    ctaLabel: "Plan een demo",
    ctaHref: "#contact",
    highlight: false,
  },
  {
    name: "Pro",
    price: "€79",
    priceSuffix: "/maand",
    period: "excl. 21% btw",
    description: "Volledige automatisering, multi-locatie en API.",
    features: [
      "Alles van Basic",
      "AI-host voor telefoon, WhatsApp en webchat (1 agent)",
      "Slimme herbevestiging + risicoscores per gast",
      "Wachtlijst met automatische matching bij annulering",
      "Volledige rapportages + export",
      "POS-koppeling met artikelen + AI-koppeling",
      "Publieke API & webhooks (live)",
      "Multi-locatie",
      "Prioriteit support en onboarding",
    ],
    addon: "AI-telefonie, WhatsApp en SMS lopen via de ClickWise add-on (zie hieronder).",
    ctaLabel: "Plan een demo",
    ctaHref: "#contact",
    highlight: true,
    badge: "Aanbevolen",
  },
];

const clickwiseFeatures = [
  { icon: Phone, label: "AI-telefonie 24/7 met eigen nummer" },
  { icon: MessageSquare, label: "WhatsApp Business + SMS-bevestigingen" },
  { icon: Sparkles, label: "Automation-flows: herbevestiging, reviews, no-show opvolging" },
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
            Vaste maandprijs, géén commissie per couvert, maandelijks opzegbaar.
            <br className="hidden md:block" />
            Alle prijzen zijn <strong>exclusief 21% btw</strong>.
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
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className={cn("font-display text-4xl font-bold", isPro ? "text-primary-foreground" : "text-foreground")}>
                    {t.price}
                  </span>
                  {t.priceSuffix && (
                    <span className={cn("text-base font-medium", isPro ? "text-primary-foreground/85" : "text-muted-foreground")}>
                      {t.priceSuffix}
                    </span>
                  )}
                </div>
                <div className={cn("mt-1 text-xs", isPro ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {t.period}
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {t.features.map((f) => (
                    <li key={f} className={cn("flex items-start gap-2.5 text-sm", isPro ? "text-primary-foreground/90" : "text-foreground/85")}>
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", isPro ? "text-accent" : "text-primary")} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {t.addon && (
                  <p
                    className={cn(
                      "mt-5 rounded-lg border p-3 text-xs leading-relaxed",
                      isPro
                        ? "border-primary-foreground/20 bg-primary-foreground/5 text-primary-foreground/85"
                        : "border-accent/30 bg-accent/5 text-foreground/80",
                    )}
                  >
                    {t.addon}
                  </p>
                )}

                <div className="mt-6">
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

        {/* ClickWise add-on */}
        <div className="mt-12 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 via-card to-card p-6 shadow-soft md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
                Optionele add-on
              </span>
              <h3 className="mt-3 font-display text-2xl font-bold md:text-3xl">
                ClickWise voor AI-telefonie, WhatsApp & SMS
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                Wil je dat een AI-host gasten 24/7 te woord staat, of bevestigingen en reminders via
                WhatsApp en SMS sturen? Dan heb je een actief <strong>ClickWise account-abonnement</strong> nodig.
                TableWise stuurt de events, ClickWise levert de communicatiekanalen en het telefoonnummer.
              </p>
              <ul className="mt-5 space-y-2.5">
                {clickwiseFeatures.map((f) => (
                  <li key={f.label} className="flex items-start gap-2.5 text-sm text-foreground/85">
                    <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-background p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ClickWise add-on
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-bold text-foreground">vanaf €79</span>
                <span className="text-sm font-medium text-muted-foreground">/maand</span>
              </div>
              <div className="text-xs text-muted-foreground">excl. 21% btw</div>

              <ul className="mt-4 space-y-2 text-sm text-foreground/85">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Inclusief eigen telefoonnummer</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Eenmalige setup: <strong>€189</strong> (excl. btw)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Variabele kosten voor telefoon-, SMS- en WhatsApp-verkeer</span>
                </li>
              </ul>

              <Button asChild size="lg" className="mt-5 h-12 w-full">
                <a href="#contact">Vraag ClickWise add-on aan</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
