// AIQuickSeatInput — natuurlijke-taal invoer voor walk-ins.
// Geen LLM-call: de parser is een veilige regex-heuristiek (zie quickSeatParser.ts).
// Toont een interpretatiekaart en vereist altijd menselijke bevestiging
// voordat een walk-in wordt aangemaakt.

import { useMemo, useState } from "react";
import { Sparkles, Wand2, AlertTriangle, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { parseQuickSeat, type ParsedQuickSeat } from "@/lib/quickSeatParser";
import type { WalkInQuickPrefill } from "./WalkInQuickSheet";

const EXAMPLES = [
  "2 personen terras",
  "4 personen binnen",
  "3 personen bar",
  "6 personen 90 minuten",
];

type Zone = { id: string; name: string };

type Props = {
  zones: Zone[];
  /** Called when operator confirms the interpretation. */
  onConfirm: (prefill: WalkInQuickPrefill) => void;
};

export function AIQuickSeatInput({ zones, onConfirm }: Props) {
  const [text, setText] = useState("");
  const parsed: ParsedQuickSeat | null = useMemo(
    () => (text.trim().length === 0 ? null : parseQuickSeat(text)),
    [text],
  );

  const matchedZone = parsed?.zoneHint
    ? zones.find(z => z.name.toLowerCase().includes(parsed.zoneHint!))
    : undefined;

  const summaryParts: string[] = [];
  if (parsed?.partySize) summaryParts.push(`${parsed.partySize} ${parsed.partySize === 1 ? "persoon" : "personen"}`);
  if (matchedZone) summaryParts.push(matchedZone.name);
  else if (parsed?.zoneHint) summaryParts.push(parsed.zoneHint);
  if (parsed?.immediate) summaryParts.push("nu");
  if (parsed?.durationMinutes) summaryParts.push(`${parsed.durationMinutes} min`);

  const canConfirm = !!parsed?.partySize;

  const handleConfirm = () => {
    if (!parsed?.partySize) return;
    onConfirm({
      partySize: parsed.partySize,
      zoneId: matchedZone?.id ?? null,
      durationMinutes: parsed.durationMinutes ?? undefined,
      notes: parsed.noteFragment ?? undefined,
    });
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 font-display">
              <Sparkles className="h-5 w-5 text-primary" /> AI Quick Seat
            </CardTitle>
            <CardDescription className="mt-1">
              Beschrijf in één zin wat je nodig hebt. Geen acties zonder jouw bevestiging.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Wand2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 200))}
            placeholder="Bijv. 2 personen op terras nu"
            className="h-12 pl-9 text-base"
            aria-label="AI Quick Seat invoer"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="text-[11px] rounded-full border border-border bg-card px-2.5 py-1 hover:border-primary/40 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>

        {parsed && (
          <div className={cn(
            "rounded-lg border p-3 space-y-2",
            parsed.confidence === "low"   && "border-warning/40 bg-warning/5",
            parsed.confidence === "medium" && "border-border bg-muted/30",
            parsed.confidence === "high"  && "border-primary/30 bg-primary/5",
          )}>
            {summaryParts.length > 0 ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Geïnterpreteerd als:</span>{" "}
                <strong>{summaryParts.join(" · ")}</strong>
                {parsed.noteFragment && <span className="text-muted-foreground"> · notitie: “{parsed.noteFragment}”</span>}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ik mis het aantal personen. Kies het aantal of typ bijvoorbeeld: <em>2 personen terras</em>.
              </p>
            )}

            {parsed.confidence !== "high" && parsed.partySize !== null && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-warning" />
                Ik weet het niet helemaal zeker. Controleer de gegevens voordat je de walk-in plaatst.
              </div>
            )}
            {parsed.warnings.map((w, i) => (
              <p key={i} className="text-xs text-muted-foreground">· {w}</p>
            ))}

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="h-10"
              >
                Plaats walk-in <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setText("")}
                className="h-10"
              >
                Wissen
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
