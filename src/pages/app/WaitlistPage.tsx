import { Button } from "@/components/ui/button";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { Plus, Send } from "lucide-react";

const WaitlistPage = () => (
  <PlaceholderPage
    title="Wachtlijst"
    intro="Voorkom lege tafels. Bij annulering kunnen wachtende gasten automatisch een vrijgekomen tijdslot aangeboden krijgen."
    comingSoon="Automatische match-engine en bericht-verzending volgen. UI en datastructuur zijn voorbereid."
    actions={
      <Button size="lg" className="h-11">
        <Plus className="mr-2 h-4 w-4" /> Wachtlijstitem
      </Button>
    }
    sections={[
      {
        title: "Actieve wachtlijst",
        description: "Vandaag — 4 items",
        items: [
          { label: "Pieters — 2p — terras", meta: "19:00–20:00 · 06-12345678", badge: "Wacht op plek" },
          { label: "Hendriks — 4p — binnen", meta: "Vanaf 18:30 · flexibel", badge: "Match gevonden" },
          { label: "De Boer — 6p — serre", meta: "20:00 · grote groep", badge: "Bericht gestuurd" },
          { label: "Smit — 2p — geen voorkeur", meta: "Avond, flexibel", badge: "Bevestigd" },
        ],
      },
      {
        title: "Hoe het werkt",
        description: "Service-first matching",
        items: [
          { label: "1. Reservering wordt geannuleerd" },
          { label: "2. Systeem zoekt match in wachtlijst (party, tijd, zone)" },
          { label: "3. Beste match krijgt bericht via WhatsApp/SMS" },
          { label: "4. Gast bevestigt → reservering aangemaakt" },
        ],
      },
      {
        title: "Conversie deze week",
        items: [
          { label: "Geredde tafels", meta: "Vrijgekomen door annulering", badge: "12" },
          { label: "Berichten verstuurd", meta: "Wachtlijst-matches", badge: "18" },
          { label: "Conversieratio", meta: "Bericht → bevestigd", badge: "67%" },
        ],
      },
      {
        title: "Microcopy gast",
        description: "Toon waarmee we wachtende gasten benaderen",
        children: (
          <blockquote className="rounded-md border-l-2 border-primary bg-muted/30 px-4 py-3 text-sm italic">
            "Goed nieuws! Er is een tafel vrijgekomen voor vanavond 19:00. Reageer met JA om te bevestigen."
          </blockquote>
        ),
      },
    ]}
  >
    <div className="flex justify-end">
      <Button variant="outline" disabled>
        <Send className="mr-2 h-4 w-4" /> Match-bericht versturen
      </Button>
    </div>
  </PlaceholderPage>
);

export default WaitlistPage;
