import { Button } from "@/components/ui/button";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { UserPlus, Check, MapPin, Move, Bell, Bot } from "lucide-react";

const FloorModePage = () => (
  <PlaceholderPage
    title="Floor Mode"
    intro="Tablet-first vloerbediening voor tijdens service. Eén tik per actie, grote knoppen, geen ruis."
    badge="Tablet-first"
    comingSoon="Volledige drag-and-drop tafelweergave en POS-statussen volgen in een latere fase. Onderstaande knoppen zijn voorbereid."
    actions={
      <>
        <Button size="lg" className="h-12">
          <UserPlus className="mr-2 h-5 w-5" /> + Walk-in
        </Button>
        <Button size="lg" variant="outline" className="h-12">
          <Bot className="mr-2 h-5 w-5" /> AI Quick Seat
        </Button>
      </>
    }
    sections={[
      {
        title: "Aanstaande aankomsten",
        description: "Komende 30 minuten",
        items: [
          { label: "18:30 — Jansen — 4p", meta: "Tafel 7 · drankje klaarzetten", badge: "Bevestigd" },
          { label: "18:45 — Bakker — 8p", meta: "Tafel 12 · grote groep", badge: "Grote groep" },
          { label: "19:00 — Visser — 2p", meta: "Tafel 4 · herbevestiging open", badge: "Herbevestigen" },
        ],
      },
      {
        title: "Bezette tafels",
        description: "Live status",
        items: [
          { label: "Tafel 3 — De Vries (2p)", meta: "Sinds 17:50 · hoofdgang", badge: "Aan tafel" },
          { label: "Tafel 9 — Meijer (3p)", meta: "Sinds 18:15 · drankjes", badge: "Aan tafel" },
          { label: "Tafel 5 — walk-in (2p)", meta: "Bijna vrij", badge: "Bijna vrij" },
        ],
      },
      {
        title: "Wachtlijstkansen",
        description: "Gasten die direct geplaatst kunnen worden",
        items: [
          { label: "Pieters — 2p — terras", meta: "Vandaag, vanaf 19:00", badge: "Match mogelijk" },
          { label: "Hendriks — 4p — binnen", meta: "Vandaag, flexibel", badge: "Bericht klaar" },
        ],
      },
      {
        title: "Snelle acties",
        description: "Direct toegankelijk tijdens service",
        children: (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 justify-start"><Check className="mr-2 h-4 w-4" /> Gast aangekomen</Button>
            <Button variant="outline" className="h-12 justify-start"><MapPin className="mr-2 h-4 w-4" /> Seated</Button>
            <Button variant="outline" className="h-12 justify-start"><Move className="mr-2 h-4 w-4" /> Verplaats tafel</Button>
            <Button variant="outline" className="h-12 justify-start"><Bell className="mr-2 h-4 w-4" /> Bericht gast</Button>
          </div>
        ),
      },
    ]}
  />
);

export default FloorModePage;
