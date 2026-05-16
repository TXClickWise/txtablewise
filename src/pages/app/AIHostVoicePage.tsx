import { Link } from "react-router-dom";
import { TabbedPage } from "@/components/TabbedPage";
import { useAdvancedMode } from "@/hooks/useAdvancedMode";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { Bot, Phone, MessageCircle, ArrowRight, Settings2, BookOpen } from "lucide-react";
import AIHostPage from "./AIHostPage";
import VoiceAgentPage from "./VoiceAgentPage";

function SimpleAIVoiceLanding() {
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="AI & Voice"
        description="Laat een AI de telefoon, WhatsApp en chat afhandelen — boekt rechtstreeks in jouw agenda."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">AI Telefoon-agent</CardTitle>
            </div>
            <CardDescription>
              Neemt op wanneer je kookt, verzamelt naam, datum, tijd en aantal personen,
              en boekt direct in TableWise.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" size="sm">
              <Link to="/app/koppelingen">
                Instellen via Koppelingen <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">WhatsApp &amp; chat</CardTitle>
            </div>
            <CardDescription>
              Bevestigingen, herinneringen en wijzigingen via WhatsApp/SMS lopen
              automatisch via ClickWise.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full" size="sm">
              <Link to="/app/gastcommunicatie">
                Naar Gastcommunicatie <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-sm">Eerst uitleg lezen?</div>
              <div className="text-xs text-muted-foreground">
                Korte handleiding met voorbeeld-prompt en wat de AI wel/niet doet.
              </div>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/help/voice-agent">Open handleiding</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Settings2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-sm flex items-center gap-2">
                Technische instellingen
                <Badge variant="outline" className="text-[10px] uppercase">Geavanceerd</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                AI-actiecatalogus, API-sleutels, providers, test-console — alleen voor
                ontwikkelaars of partner-integraties. Zet "Geavanceerde modus" aan in{" "}
                <Link to="/app/instellingen" className="underline">Algemene instellingen</Link>.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AIHostVoicePage() {
  const { canSeeAdvanced } = useAdvancedMode();
  const { isSystemAdmin } = useIsSystemAdmin();

  // Standaard ondernemer ziet een rustige landingspagina met links naar
  // Koppelingen, Gastcommunicatie en de handleiding.
  if (!canSeeAdvanced && !isSystemAdmin) {
    return <SimpleAIVoiceLanding />;
  }

  // Advanced/admin krijgt de oude technische tabs.
  return (
    <TabbedPage
      tabs={[
        { value: "ai-host", label: "AI Host (geavanceerd)", content: <AIHostPage /> },
        { value: "voice", label: "Voice Agent (geavanceerd)", content: <VoiceAgentPage /> },
      ]}
    />
  );
}
