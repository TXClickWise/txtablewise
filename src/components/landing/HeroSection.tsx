import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-restaurant.jpg";

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img
          src={heroImage}
          alt="Sfeervolle restaurantzaal bij gouden uur met kaarslicht en gedekte tafels"
          className="h-full w-full object-cover"
          decoding="async"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/90 via-foreground/70 to-primary/55" />
      </div>

      <div className="container relative flex min-h-[88vh] flex-col justify-center pb-20 pt-32 md:min-h-[80vh] md:pb-28 md:pt-40">
        <div className="max-w-3xl animate-fade-in-up">
          <h1 className="font-display text-[2.5rem] font-semibold leading-[1.05] text-primary-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Minder no-shows.
            <br />
            Vollere tafels.
            <br />
            <span className="text-accent">Rustiger team.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-primary-foreground/85 sm:text-lg md:text-xl">
            TX TableWise is het reserveringssysteem voor restaurants die hun eigen gasten willen
            beheren — zonder commissie, zonder gedoe.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 bg-primary-foreground px-6 text-base text-primary shadow-elegant hover:bg-primary-foreground/95"
            >
              <a href="#contact">
                Plan een demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-primary-foreground/35 bg-primary-foreground/5 px-6 text-base text-primary-foreground backdrop-blur hover:bg-primary-foreground/15 hover:text-primary-foreground"
            >
              <a href="#functies">Bekijk wat het kan</a>
            </Button>
          </div>

          <ul className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-primary-foreground/80">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Commissievrij
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Eigen gastdata
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Klaar in 15 minuten
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
