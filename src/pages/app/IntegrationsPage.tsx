import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

type IntegrationStatus = "Niet gekoppeld" | "Klaar om te configureren" | "Actief" | "Demo-ready";

function IntegrationCard({
  title, description, status = "Niet gekoppeld", highlight = false, label,
}: { title: string; description: string; status?: IntegrationStatus; highlight?: boolean; label?: string }) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/[0.03]" : undefined}>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {label && (
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="mr-1 h-3 w-3" />{label}
            </Badge>
          )}
        </div>
        <CardDescription className="line-clamp-3">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <Badge variant={status === "Actief" ? "default" : "outline"} className="text-xs">{status}</Badge>
        <Button size="sm" variant={highlight ? "default" : "outline"}>
          {status === "Actief" ? "Beheren" : "Voorbereiden"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Section({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl">{title}</h2>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

const IntegrationsPage = () => (
  <div className="p-6 max-w-7xl mx-auto space-y-8">
    <div>
      <h1 className="font-display text-3xl">Integraties</h1>
      <p className="text-muted-foreground max-w-2xl">
        Eén platform — alle kanalen samen. Bouw je tech-stack op je eigen tempo, zonder afhankelijk te worden van commissieplatformen.
      </p>
    </div>

    <Section title="ClickWise / HighLevel" intro="CRM, communicatie en AI-laag voor reminders, reviews en gespreksautomatisering.">
      <Card className="border-primary/40 bg-primary/[0.03] md:col-span-2 lg:col-span-3">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">ClickWise integratielaag</CardTitle>
          <CardDescription>
            Beheer verbindingsstatus, contact sync, tags, custom fields, workflows, event queue en privacy op één plek.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">Voorbereid · sandbox</Badge>
          <Button size="sm" asChild><a href="/app/integraties/clickwise">Openen</a></Button>
        </CardContent>
      </Card>
      <IntegrationCard title="WhatsApp" description="Bevestigingen en reminders via WhatsApp Business." />
      <IntegrationCard title="SMS" description="Reminders waar WhatsApp niet beschikbaar is." />
      <IntegrationCard title="E-mail" description="Premium e-mailbevestiging met huisstijl." status="Klaar om te configureren" />
      <IntegrationCard title="Reviewflows" description="Tevreden gasten naar Google, ontevreden naar manager." />
      <IntegrationCard title="Voice AI" description="Telefonische reserveringen met beschikbaarheidscheck." />
      <IntegrationCard title="Conversation AI" description="WhatsApp/webchat AI met escalatie naar mens." />
    </Section>

    <Section title="Website & reserveringskanalen" intro="Verzamel reserveringen via je eigen kanalen — commissievrij.">
      <IntegrationCard title="Website-widget" description="Embed op je eigen site. Geen externe redirect." status="Actief" />
      <IntegrationCard title="WhatsApp reserveren" description="Eén tik vanaf Google of Instagram." />
      <IntegrationCard title="SMS reserveren" description="Voor gasten zonder WhatsApp." />
      <IntegrationCard title="Webchat" description="Live chat met AI-host als basis." />
      <IntegrationCard title="Google Business Profile link" description="Reserveer-knop direct in Google." />
      <IntegrationCard title="Instagram link-in-bio" description="Korte reserveringspagina voor je bio." />
      <IntegrationCard title="QR-code voor passanten" description="Aan de gevel of op tafel." />
      <IntegrationCard title="Telefonische invoer" description="Snel toevoegen tijdens een telefoontje." status="Actief" />
      <IntegrationCard title="Handmatige reservering" description="Voor walk-ins en uitzonderingen." status="Actief" />
    </Section>

    <Section title="POS-systemen" intro="Het systeem blijft waardevol zonder POS-koppeling, maar is voorbereid op omzetinzichten per reservering, tafel en gast.">
      <IntegrationCard
        title="Loyverse POS"
        description="Gratis POS-basis voor kleine horeca. Ideaal om te starten en later omzetdata aan reserveringen te koppelen. Geavanceerde Loyverse-functies kunnen betaalde add-ons vereisen."
        status="Demo-ready"
        highlight
        label="Aanbevolen starter-POS"
      />
      <IntegrationCard title="Lightspeed" description="Toekomstige koppeling — omzet per couvert." />
      <IntegrationCard title="unTill" description="Toekomstige koppeling voor middelgrote horeca." />
      <IntegrationCard title="Vectron" description="Toekomstige koppeling." />
      <IntegrationCard title="Booq" description="Toekomstige koppeling." />
      <IntegrationCard title="Twelve" description="Toekomstige koppeling." />
      <IntegrationCard title="MplusKASSA" description="Toekomstige koppeling." />
      <IntegrationCard title="Eijsink" description="Toekomstige koppeling." />
      <IntegrationCard title="Winston" description="Toekomstige koppeling." />
      <IntegrationCard title="Tebi" description="Toekomstige koppeling." />
      <IntegrationCard title="Anders / API" description="Custom POS via webhook of REST API." />
    </Section>
  </div>
);

export default IntegrationsPage;
