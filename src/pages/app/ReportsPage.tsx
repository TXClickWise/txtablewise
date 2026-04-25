import { PlaceholderPage } from "@/components/PlaceholderPage";
import { Card, CardContent } from "@/components/ui/card";

const cards = [
  { l: "Covers vandaag", v: "—", h: "Bezet aantal couverts" },
  { l: "Reserveringen per kanaal", v: "—", h: "Website, WhatsApp, walk-in, AI" },
  { l: "Walk-ins", v: "—", h: "Spontane gasten deze week" },
  { l: "Wachtlijstconversie", v: "—", h: "Bericht → bevestigd" },
  { l: "No-shows", v: "—", h: "Trend per week" },
  { l: "Late annuleringen", v: "—", h: "< 4 uur vooraf" },
  { l: "Herbevestigingen", v: "—", h: "Magic link respons" },
  { l: "Grote groepen", v: "—", h: "Aantal en gemiddelde grootte" },
  { l: "Pre-order drankjes", v: "—", h: "Aantal en omzet" },
  { l: "Bezetting per shift", v: "—", h: "Lunch / diner" },
  { l: "Reviews", v: "—", h: "Gemiddelde score" },
  { l: "Terugkerende gasten", v: "—", h: "Aandeel van totaal" },
  { l: "Commissievrije reserveringen", v: "—", h: "Via eigen kanalen" },
  { l: "Omzetinzicht (POS-ready)", v: "—", h: "Beschikbaar na POS-koppeling" },
];

const ReportsPage = () => (
  <PlaceholderPage
    title="Rapportages"
    intro="Inzicht in wat werkt — per kanaal, per shift, per gastsegment. Echte data komt zodra reserveringen, ClickWise en POS gekoppeld zijn."
    comingSoon="Cijfers worden later live ingevuld vanuit reserveringen, ClickWise events en POS-omzet."
  >
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.l}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{c.l}</div>
            <div className="font-display text-3xl mt-1">{c.v}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.h}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  </PlaceholderPage>
);

export default ReportsPage;
