import { useEffect, useMemo, useState } from "react";
import { differenceInMinutes, format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Users, Clock, Check, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

/** True wanneer het scherm landscape is én breed genoeg voor een side sheet (tablet liggend / desktop). */
function useLandscapeSideSheet() {
  const [isSide, setIsSide] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(orientation: landscape) and (min-width: 768px)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsSide(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isSide;
}


type Zone = { id: string; name: string };
type Table = {
  id: string; label: string; zone_id: string | null;
  capacity_min: number; capacity_max: number;
  combinable: boolean;
  shape: string;
};
type Res = {
  id: string; start_time: string; end_time: string; status: string;
  reservation_tables: { table_id: string }[];
};

export type QuickSeatSuggestion = {
  table: Table;
  score: number;
  reasons: string[];
  freeUntilMinutes: number | null; // null = vrij tot eind dienst
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  zones: Zone[];
  tables: Table[];
  reservations: Res[];
  defaultDurationMinutes: number; // bv. restaurant.default_reservation_minutes
  largeGroupThreshold: number;
  largeGroupMinutes: number;
  onPick: (table: Table) => void;
};

export function AIQuickSeatSheet({
  open, onOpenChange, zones, tables, reservations,
  defaultDurationMinutes, largeGroupThreshold, largeGroupMinutes,
  onPick,
}: Props) {
  const [partySize, setPartySize] = useState(2);
  const [zoneId, setZoneId] = useState<string>("any");
  const sideSheet = useLandscapeSideSheet();


  const duration = partySize >= largeGroupThreshold ? largeGroupMinutes : defaultDurationMinutes;
  const now = new Date();
  const candidateEnd = new Date(now.getTime() + duration * 60_000);

  const suggestions = useMemo<QuickSeatSuggestion[]>(() => {
    // Tafels die nu echt vrij zijn voor de hele duur
    const candidates = tables.filter((t) => {
      if (zoneId !== "any" && t.zone_id !== zoneId) return false;
      if (t.capacity_max < partySize) return false; // te klein
      // Geen reservering die overlapt met onze [now, now+duration)
      const conflict = reservations.some((r) => {
        if (!r.reservation_tables.some((rt) => rt.table_id === t.id)) return false;
        const rs = new Date(r.start_time);
        const re = new Date(r.end_time);
        return rs < candidateEnd && now < re;
      });
      return !conflict;
    });

    // Score
    return candidates
      .map((t): QuickSeatSuggestion => {
        const reasons: string[] = [];
        let score = 100;

        // Capaciteit-fit: hoe dichter bij party_size, hoe beter
        const fit = t.capacity_max - partySize;
        if (fit === 0) { score += 40; reasons.push("Past precies"); }
        else if (fit === 1) { score += 25; reasons.push("Past goed"); }
        else if (fit <= 2) { score += 10; reasons.push("Past royaal"); }
        else { score -= fit * 6; reasons.push(`${fit} stoel(en) over`); }

        // Combinable straffen — die houden we liefst vrij voor grotere groepen later
        if (t.combinable && partySize <= 4) { score -= 15; }

        // Zone-bonus als gekozen
        if (zoneId !== "any" && t.zone_id === zoneId) { score += 10; reasons.push("In gekozen zone"); }

        // Hoe lang nog vrij? Eerstvolgende reservering die deze tafel claimt
        const nextRes = reservations
          .filter((r) => r.reservation_tables.some((rt) => rt.table_id === t.id))
          .map((r) => new Date(r.start_time))
          .filter((d) => d > candidateEnd)
          .sort((a, b) => a.getTime() - b.getTime())[0];

        const freeUntilMinutes = nextRes ? differenceInMinutes(nextRes, now) : null;
        if (freeUntilMinutes === null) {
          reasons.push("Geen volgende reservering");
        } else {
          reasons.push(`Vrij tot ${format(nextRes!, "HH:mm")}`);
          // Bonus voor "ruim genoeg" (>= duration + 30 min buffer)
          if (freeUntilMinutes >= duration + 30) score += 8;
        }

        return { table: t, score, reasons, freeUntilMinutes };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [tables, reservations, partySize, zoneId, candidateEnd, now, duration]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={sideSheet ? "right" : "bottom"}
        className={cn(
          "overflow-y-auto pb-[env(safe-area-inset-bottom)]",
          sideSheet
            ? "w-[min(440px,90vw)] sm:max-w-[440px] h-[100dvh]"
            : "rounded-t-2xl max-h-[90dvh]",
        )}
      >

        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> AI Quick Seat
          </SheetTitle>
          <SheetDescription>
            Beste vrije tafel voor een walk-in nu. Suggesties op basis van capaciteit, zone en aankomende reserveringen.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> Aantal personen</Label>
            <Input
              type="number" min={1} max={50}
              value={partySize}
              onChange={(e) => setPartySize(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-12 text-lg"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Zone-voorkeur</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Geen voorkeur</SelectItem>
                {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
          <Clock className="h-3 w-3" />
          Verblijfsduur: {duration} min
          {partySize >= largeGroupThreshold && <span className="text-warning">· grote groep</span>}
        </div>

        <div className="mt-4 space-y-2">
          {suggestions.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Geen geschikte tafel gevonden voor {partySize}p
              {zoneId !== "any" ? ` in deze zone` : ""}.
              <br />Probeer een andere zone, kleinere groep, of plaats handmatig.
            </div>
          ) : (
            suggestions.map((s, idx) => (
              <button
                key={s.table.id}
                onClick={() => { onPick(s.table); onOpenChange(false); }}
                className={cn(
                  "w-full text-left rounded-lg border-2 p-4 transition-all active:scale-[0.99]",
                  idx === 0
                    ? "border-primary bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-12 w-12 flex items-center justify-center font-display text-lg border-2",
                      s.table.shape === "round" ? "rounded-full" : "rounded-md",
                      idx === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted",
                    )}>
                      {s.table.label}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        Tafel {s.table.label}
                        {idx === 0 && (
                          <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                            Beste keuze
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.table.capacity_min}-{s.table.capacity_max}p ·{" "}
                        {zones.find((z) => z.id === s.table.zone_id)?.name ?? "Geen zone"}
                      </div>
                    </div>
                  </div>
                  <Check className={cn("h-5 w-5", idx === 0 ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.reasons.map((r) => (
                    <span key={r} className="text-[11px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                      {r}
                    </span>
                  ))}
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
