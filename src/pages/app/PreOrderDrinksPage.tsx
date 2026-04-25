import { Button } from "@/components/ui/button";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { Plus } from "lucide-react";

const PreOrderDrinksPage = () => (
  <PlaceholderPage
    title="Drankjes vooraf"
    intro="Laat gasten een welkomstdrankje of fles wijn klaarzetten. Verhoogt beleving én gemiddelde besteding."
    comingSoon="Betaling vooraf is in MVP nog niet actief. Pre-order tonen aan keuken/bar werkt al via reserveringsnotities."
    actions={
      <Button size="lg" className="h-11">
        <Plus className="mr-2 h-4 w-4" /> Drankoptie toevoegen
      </Button>
    }
    sections={[
      {
        title: "Actieve drankopties",
        items: [
          { label: "Prosecco per glas", meta: "Welkomstdrankje", badge: "€ 7,50" },
          { label: "Alcoholvrije cocktail", meta: "Mocktail van het huis", badge: "€ 6,50" },
          { label: "Fles huiswijn wit", meta: "Sauvignon", badge: "€ 26,—" },
          { label: "Speciaalbier lokaal", meta: "Op fles", badge: "€ 5,—" },
          { label: "Cocktail van de maand", meta: "Vraag bediening", badge: "€ 11,—" },
        ],
      },
      {
        title: "Reserveringen met pre-order",
        items: [
          { label: "Jansen — 4p — 18:30", meta: "2× prosecco klaarzetten", badge: "Bevestigd" },
          { label: "Bakker — 8p — 19:00", meta: "Fles huiswijn + 4× speciaalbier", badge: "Grote groep" },
          { label: "Visser — 2p — 19:15", meta: "2× alcoholvrije cocktail", badge: "Bevestigd" },
        ],
      },
    ]}
  />
);

export default PreOrderDrinksPage;
