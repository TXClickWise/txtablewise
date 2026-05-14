import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-restaurant.jpg";

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-[hsl(222,44%,8%)]">
      {/* Sfeervolle horecafotografie als hero-achtergrond, met warme donkere overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Sfeervolle restaurantzaal bij gouden uur met kaarslicht en gedekte tafels"
          width={1920}
          height={1280}
          className="h-full w-full object-cover"
          decoding="async"
          fetchPriority="high"
        />
        {/* Warme donkere overlay: leesbaarheid voor tekst, sfeer behouden */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,44%,8%)]/85 via-[hsl(222,40%,12%)]/55 to-[hsl(28,40%,10%)]/75" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,hsl(40_72%_52%/0.18),transparent_55%),radial-gradient(ellipse_at_80%_20%,hsl(210_72%_30%/0.18),transparent_55%)]" />
      </div>

      <div className="container relative flex min-h-[88vh] flex-col justify-center pb-20 pt-32 md:min-h-[80vh] md:pb-28 md:pt-40">
        <div className="max-w-3xl animate-fade-in-up">
          <div className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Vanaf Texel, voor heel Nederland
          </div>
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] text-primary-foreground md:text-7xl">
            Minder no-shows.
            <br />
            Vollere tafels.
            <br />
            <span className="bg-gradient-to-r from-accent to-[hsl(36,80%,62%)] bg-clip-text text-transparent">
              Rustiger team.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-primary-foreground/80 md:text-xl">
            Het premium reserveringssysteem dat meedenkt. Van slimme tafelverdeling tot
            AI-reserveringen — zonder commissie, zonder extern platform.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="xl">
              <a href="#contact">
                Plan een demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-primary-foreground/30 bg-primary-foreground/5 text-primary-foreground backdrop-blur hover:bg-primary-foreground/15 hover:text-primary-foreground hover:border-primary-foreground/50"
            >
              <a href="#functies">Bekijk wat het kan</a>
            </Button>
          </div>

          <ul className="mt-12 flex flex-wrap items-center gap-2">
            {["Commissievrij", "Eigen gastdata", "AI-reserveringen 24/7", "Klaar in 15 minuten"].map((t) => (
              <li key={t} className="trust-pill">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
