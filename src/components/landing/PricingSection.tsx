import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Phone, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Trial",
    price: "Gratis",
    priceSuffix: "",
    period: "14 dagen, alles inbegrepen",
    description: "Even rustig zelf uitproberen. Geen creditcard nodig.",
    features: [
      "Tot 50 reserveringen om te proberen",
      "Tafelplan, zones en bediening op tablet",
      "Walk-ins en wachtlijst",
      "Bevestigingen en herinneringen per e-mail",
      "Gastenboek met allergieën en voorkeuren",
      "Heldere dagrapportages",
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
    description: "Alles wat je nodig hebt om je service rustig te draaien.",
    features: [
      "Onbeperkt reserveringen",
      "Slim tafelplan dat zelf de beste plek voorstelt",
      "Walk-ins, wachtlijst en grote groepen",
      "Minder no-shows: bevestiging, herinnering en herbevestiging",
      "Eigen gastenboek met allergieën, voorkeuren en VIP-gasten",
      "Bedankjes en reviews na het bezoek",
      "Weersverwachting met tips voor jouw service",
      "Werkt samen met je kassa (Loyverse) zodat je weet wat er op tafel staat",
      "E-mail support",
    ],
    addon: "WhatsApp, SMS en een AI-gastvrouw aan de telefoon? Dat regelt de optionele ClickWise add-on hieronder.",
    ctaLabel: "Start met Basic",
    ctaTo: "/auth?mode=signup&plan=basic",
    secondaryHref: "#contact",
    secondaryLabel: "of plan eerst een rondleiding",
    highlight: false,
  },
  {
    name: "Pro",
    price: "€79",
    priceSuffix: "/maand",
    period: "excl. 21% btw",
    description: "Voor zaken die alles op de automatische piloot willen — en meerdere locaties.",
    features: [
      "Alles van Basic",
      "AI-gastvrouw die 24/7 telefoon, WhatsApp en webchat aanneemt",
      "Slimme herbevestiging en signaal bij gasten met no-show risico",
      "Wachtlijst die zelf gasten matcht bij een annulering",
      "Volledige rapportages, ook om te exporteren",
      "Volledige kassa-koppeling, inclusief gerechten en slimme suggesties",
      "Werkt voor één zaak of meerdere locaties",
      "Koppelt met je bestaande software (boekhouding, marketing, kassa)",
      "Voorrang bij support en persoonlijke onboarding",
    ],
    addon: "AI aan de telefoon, WhatsApp en SMS lopen via de ClickWise add-on hieronder.",
    ctaLabel: "Start met Pro",
    ctaTo: "/auth?mode=signup&plan=pro",
    secondaryHref: "#contact",
    secondaryLabel: "of plan eerst een rondleiding",
    highlight: true,
    badge: "Aanbevolen",
  },
];

const clickwiseFeatures = [
  { icon: Phone, label: "AI-gastvrouw 24/7 aan je eigen telefoonnummer" },
  { icon: MessageSquare, label: "Bevestigingen en herinneringen via WhatsApp en SMS" },
  { icon: Sparkles, label: "Automatische herbevestiging, reviews en opvolging na no-show" },
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
            Vaste maandprijs, géén commissie per gast, maandelijks opzegbaar.
            <br className="hidden md:block" />
            Alle prijzen zijn <strong>exclusief 21% btw</strong>.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {tiers.map((t, i) => {
            const isPro = t.highlight;
            return (
              <RevealOnScroll key={t.name} delayMs={i * 120} className="h-full">
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl p-7 transition-all duration-300",
                  isPro
                    ? "bg-gradient-hero text-primary-foreground shadow-prominent shadow-glow-gold lg:scale-[1.05] border border-accent/40 z-10"
                    : t.name === "Trial"
                      ? "bg-card border border-border hover:-translate-y-1 hover:shadow-soft"
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

                <div className="mt-6 space-y-2">
                  <Button asChild size="lg" className="h-12 w-full text-base" variant={isPro ? "default" : "outline"}>
                    <Link to={t.ctaTo}>{t.ctaLabel}</Link>
                  </Button>
                  {t.secondaryHref && (
                    <a
                      href={t.secondaryHref}
                      className={cn(
                        "block text-center text-xs underline-offset-4 hover:underline",
                        isPro ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {t.secondaryLabel}
                    </a>
                  )}
                </div>
              </div>
              </RevealOnScroll>
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
                ClickWise: telefoon, WhatsApp en SMS in één
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                Wil je dat een vriendelijke AI-gastvrouw je gasten dag en nacht te woord staat — of
                bevestigingen en herinneringen via WhatsApp en SMS sturen? Dan zet je de
                <strong> ClickWise add-on </strong>aan. Je eigen telefoonnummer, alle berichten op één plek,
                rechtstreeks gekoppeld aan TX TableWise.
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
                  <span>Inclusief je eigen telefoonnummer</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Eenmalige opstart: <strong>€189</strong> (excl. btw)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Belminuten en berichten op gebruik</span>
                </li>
              </ul>

              <Button asChild size="lg" className="mt-5 h-12 w-full">
                <a href="#contact">Vraag ClickWise aan</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
