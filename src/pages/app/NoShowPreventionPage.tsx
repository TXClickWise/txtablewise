import { PlaceholderPage } from "@/components/PlaceholderPage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const NoShowPreventionPage = () => (
  <PlaceholderPage
    title="No-show preventie"
    intro="Minder lege stoelen door slimme bevestigingen, reminders en herbevestiging — gastvrij, niet streng."
    badge="Kernmodule"
    comingSoon="WhatsApp/SMS-verzending loopt later via ClickWise. E-mailbevestiging en magic-link herbevestiging zijn al voorbereid."
    sections={[
      {
        title: "Bevestigingen",
        description: "Direct na de reservering",
        items: [
          { label: "E-mail bevestiging", badge: "Voorbereid" },
          { label: "WhatsApp bevestiging", badge: "Via ClickWise" },
          { label: "SMS bevestiging", badge: "Via ClickWise" },
        ],
      },
      {
        title: "Reminders",
        description: "Op het juiste moment",
        items: [
          { label: "24 uur vooraf", badge: "Standaard" },
          { label: "2 uur vooraf", badge: "Aanbevolen" },
          { label: "Eigen reminder", meta: "Bijv. avond ervoor 20:00", badge: "Optioneel" },
        ],
      },
      {
        title: "Herbevestiging via magic link",
        description: "Eén tik — geen login",
        items: [
          { label: "Knop 'Ik kom'", badge: "Actief" },
          { label: "Knop 'Ik kan toch niet'", meta: "Triggert wachtlijst-match", badge: "Actief" },
          { label: "Tijdige herbevestiging", meta: "Verlaagt no-show risico", badge: "Tracked" },
        ],
      },
      {
        title: "Slimme regels",
        items: [
          { label: "Extra reminder bij grote groepen", badge: "Aan" },
          { label: "Extra reminder bij piekmomenten", badge: "Aan" },
          { label: "Aanbetaling aanbevelen bij grote groepen", badge: "Optioneel" },
          { label: "Vaste gasten uitzonderen", badge: "Aan" },
          { label: "No-show risico intern tonen", badge: "Aan" },
        ],
      },
    ]}
  >
    <Card>
      <CardHeader>
        <CardTitle>Rapportage — deze week</CardTitle>
        <CardDescription>Mockcijfers — echte data komt zodra reminders actief zijn</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { v: "3", l: "No-shows" },
          { v: "5", l: "Late annuleringen" },
          { v: "12", l: "Geredde tafels via wachtlijst" },
          { v: "7", l: "Herbevestigingen open" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border p-4">
            <div className="font-display text-3xl">{s.v}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.l}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  </PlaceholderPage>
);

export default NoShowPreventionPage;
