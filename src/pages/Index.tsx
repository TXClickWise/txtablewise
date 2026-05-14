import { Helmet } from "react-helmet-async";
import { LandingHeader } from "@/components/landing/LandingHeader";
import heroImage from "@/assets/hero-restaurant.jpg";
import { HeroSection } from "@/components/landing/HeroSection";
import { PainPointsSection } from "@/components/landing/PainPointsSection";
import { SolutionGrid } from "@/components/landing/SolutionGrid";
import { WhyTableWiseSection } from "@/components/landing/WhyTableWiseSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { DemoRequestForm } from "@/components/landing/DemoRequestForm";
import { LandingFooter } from "@/components/landing/LandingFooter";

const SITE_URL = "https://txtablewise.nl";

const Index = () => {
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TX TableWise",
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-192.png`,
    description:
      "Premium, AI-first tafelreserveringssysteem voor Nederlandse horeca.",
  };
  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TX TableWise",
    url: SITE_URL,
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>TX TableWise — Premium tafelreserveringen voor horeca</title>
        <meta
          name="description"
          content="TX TableWise: het premium, AI-first tafelreserveringssysteem voor Nederlandse horeca. Minder no-shows, snellere walk-ins, betere gastbeleving."
        />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <link rel="preload" as="image" href={heroImage} />
        <meta property="og:title" content="TX TableWise — Premium tafelreserveringen voor horeca" />
        <meta
          property="og:description"
          content="Premium, AI-first tafelreserveringen voor Nederlandse horeca. Minder no-shows, betere gastbeleving."
        />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(orgLd)}</script>
        <script type="application/ld+json">{JSON.stringify(siteLd)}</script>
      </Helmet>
      <LandingHeader />
      <main>
        <HeroSection />
        <PainPointsSection />
        <SolutionGrid />
        <WhyTableWiseSection />
        <TrustSection />
        <PricingSection />

        <section id="contact" className="bg-gradient-warm py-20 md:py-28">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                Plan een demo
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-5xl">
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
