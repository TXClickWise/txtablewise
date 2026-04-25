// Template preview — laat zien welke berichten ClickWise later kan versturen.
import { aftercareTemplates } from "@/services/reviews";

type Props = { restaurantName: string };

export function AftercareTemplatePreview({ restaurantName }: Props) {
  const blocks = [
    { t: "Bedankbericht",        body: aftercareTemplates.thankYou(restaurantName) },
    { t: "Tevredenheidsvraag",   body: aftercareTemplates.satisfaction() + "\n— Heel goed · Goed · Matig · Niet goed" },
    { t: "Positieve feedback",   body: aftercareTemplates.positive() },
    { t: "Neutrale feedback",    body: aftercareTemplates.neutral() },
    { t: "Negatieve feedback",   body: aftercareTemplates.negative() },
    { t: "Terugkomactie",        body: aftercareTemplates.returnOffer() },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {blocks.map((b) => (
        <div key={b.t} className="rounded-lg border p-3 bg-muted/30">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">{b.t}</div>
          <p className="text-sm whitespace-pre-line">{b.body}</p>
        </div>
      ))}
      <p className="text-xs text-muted-foreground md:col-span-2">
        Templates worden later via ClickWise-workflows verstuurd.
      </p>
    </div>
  );
}
