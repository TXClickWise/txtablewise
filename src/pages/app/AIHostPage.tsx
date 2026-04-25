import { PlaceholderPage } from "@/components/PlaceholderPage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Phone, MessageSquare, MessageCircle, Globe, UserCheck, ShieldCheck } from "lucide-react";

const channels = [
  { icon: Phone, t: "Voice AI", d: "Neemt op wanneer je kookt" },
  { icon: MessageCircle, t: "WhatsApp AI", d: "Antwoordt direct, dag en nacht" },
  { icon: MessageSquare, t: "SMS AI", d: "Korte heldere antwoorden" },
  { icon: Globe, t: "Webchat AI", d: "Op je eigen website" },
  { icon: UserCheck, t: "Doorverbinden naar medewerker", d: "Bij twijfel of klacht" },
  { icon: ShieldCheck, t: "Veilige reserveringsacties", d: "Altijd via beschikbaarheidscheck" },
];

const AIHostPage = () => (
  <PlaceholderPage
    title="AI Host"
    intro="AI mag gesprekken voeren. De reserveringsengine beslist of er echt plek is. Geen dubbele boekingen — ooit."
    badge="AI-ready"
    comingSoon="Voice/WhatsApp AI loopt straks via ClickWise. De acties hieronder zijn al gedefinieerd in de architectuur."
    sections={[
      {
        title: "AI-acties — toegestaan",
        description: "Veilig binnen onze beschikbaarheidsregels",
        items: [
          { label: "Beschikbaarheid controleren", badge: "Actief" },
          { label: "Reservering aanmaken", badge: "Actief" },
          { label: "Reservering wijzigen", badge: "Actief" },
          { label: "Reservering annuleren", badge: "Actief" },
          { label: "Zoeken op telefoonnummer", badge: "Actief" },
          { label: "Walk-in aanmaken", badge: "Actief" },
          { label: "Wachtlijstitem aanmaken", badge: "Actief" },
        ],
      },
      {
        title: "Wanneer schakelt AI een mens in",
        description: "Hospitality-first vangnet",
        items: [
          { label: "Twijfel over wens of timing" },
          { label: "Grote groepen die goedkeuring nodig hebben" },
          { label: "Klachten of negatieve emoties" },
          { label: "Onduidelijke verzoeken of taalbarrière" },
          { label: "Speciale gelegenheden met maatwerk" },
        ],
      },
    ]}
  >
    <Card>
      <CardHeader>
        <CardTitle>Kanalen</CardTitle>
        <CardDescription>Eén AI-host, meerdere ingangen</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {channels.map((c) => (
          <div key={c.t} className="rounded-lg border p-4">
            <c.i className="h-5 w-5 text-primary mb-2" />
            <div className="font-medium">{c.t}</div>
            <div className="text-sm text-muted-foreground">{c.d}</div>
          </div>
        ))}
      </CardContent>
    </Card>

    <Card className="bg-muted/30">
      <CardContent className="p-5 space-y-2 text-sm">
        <p>
          <span className="font-medium">Veiligheidsregel:</span> AI mag alleen reserveringen bevestigen ná een gecontroleerde
          beschikbaarheidscheck.
        </p>
        <p>
          <span className="font-medium">Vangnetregel:</span> Bij twijfel, grote groepen, klachten of onduidelijke
          verzoeken schakelt de AI een medewerker in.
        </p>
      </CardContent>
    </Card>
  </PlaceholderPage>
);

export default AIHostPage;
