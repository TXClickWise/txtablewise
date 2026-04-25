import { PlaceholderPage } from "@/components/PlaceholderPage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown, Gift, Cake, RotateCcw } from "lucide-react";

const ReviewsAftercarePage = () => (
  <PlaceholderPage
    title="Reviews & aftercare"
    intro="Houd contact ná het bezoek. Tevreden gasten naar Google, ontevreden gasten naar de manager — niet andersom."
    comingSoon="Verzending loopt later via ClickWise workflows. Logica en flow-structuur zijn voorbereid."
    sections={[
      {
        title: "Klaar om te versturen",
        description: "Bezoeken van gisteren",
        items: [
          { label: "De Vries — bezoek 19:30", meta: "2 personen · binnen", badge: "Klaar" },
          { label: "Meijer — bezoek 20:00", meta: "3 personen · terras", badge: "Klaar" },
          { label: "Familie Visser — bezoek 18:00", meta: "5 personen · serre", badge: "Klaar" },
        ],
      },
      {
        title: "Recente feedback (intern)",
        items: [
          { label: "Bakker — 'heerlijke avond, snelle bediening'", badge: "★ 5" },
          { label: "Smit — 'eten was top, wachttijd lang'", badge: "★ 3" },
          { label: "Hendriks — 'kom zeker terug'", badge: "★ 5" },
        ],
      },
    ]}
  >
    <Card>
      <CardHeader>
        <CardTitle>Aftercare flow</CardTitle>
        <CardDescription>Splitsing op tevredenheid — service-first, niet commercieel-agressief</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2 font-medium"><ThumbsUp className="h-4 w-4 text-primary" /> Tevreden gast</div>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Bedankbericht na bezoek</li>
            <li>Korte tevredenheidsvraag</li>
            <li>Vraag om Google Review</li>
            <li>Uitnodiging voor terugkomactie</li>
          </ol>
        </div>
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2 font-medium"><ThumbsDown className="h-4 w-4 text-destructive" /> Ontevreden gast</div>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Bedankbericht na bezoek</li>
            <li>Tevredenheidsvraag → lage score</li>
            <li>Intern feedbackformulier</li>
            <li>Taak voor manager — persoonlijke opvolging</li>
          </ol>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Terugkomflows</CardTitle>
        <CardDescription>Subtiel, niet pushy</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {[
          { i: Cake, t: "Verjaardag", b: "Persoonlijke uitnodiging rond verjaardag" },
          { i: RotateCcw, t: "Winback", b: "Gasten die ≥ 90 dagen weg zijn" },
          { i: Gift, t: "Loyaliteit", b: "Vaste gasten — kleine attentie bij 5e bezoek" },
        ].map((f) => (
          <div key={f.t} className="rounded-lg border p-4">
            <f.i className="h-5 w-5 text-primary mb-2" />
            <div className="font-medium">{f.t}</div>
            <div className="text-sm text-muted-foreground">{f.b}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  </PlaceholderPage>
);

export default ReviewsAftercarePage;
