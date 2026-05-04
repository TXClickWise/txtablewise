import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { PainPointsSection } from "@/components/landing/PainPointsSection";
import { SolutionGrid } from "@/components/landing/SolutionGrid";
import { TrustSection } from "@/components/landing/TrustSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { DemoRequestForm } from "@/components/landing/DemoRequestForm";
import { LandingFooter } from "@/components/landing/LandingFooter";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main>
        <HeroSection />
        <PainPointsSection />
        <SolutionGrid />
        <TrustSection />
        <PricingSection />

        <section id="contact" className="bg-gradient-warm py-20 md:py-28">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Plan een demo
              </span>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-5xl">
                Zien hoe het op jouw vloer werkt?
              </h2>
              <p className="mt-4 text-base text-muted-foreground md:text-lg">
                Vul het formulier in en we laten je in 20 minuten zien hoe TX TableWise
                jouw service rustiger laat verlopen.
              </p>
            </div>
            <div className="mx-auto mt-10 max-w-2xl">
              <DemoRequestForm />
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
};

export default Index;
