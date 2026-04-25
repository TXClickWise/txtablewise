// Compacte gastpreview voor reserveringsdetail.
// Toont allergieën/voorkeuren prominent, marketinginfo subtiel.
import { useEffect, useState } from "react";
import { Crown, AlertTriangle, BellRing, Sun, Leaf, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGuest, type Guest } from "@/services/guests";

type Props = {
  guestId: string;
  onOpenProfile?: (id: string) => void;
};

export function GuestPreviewInReservation({ guestId, onOpenProfile }: Props) {
  const [g, setG] = useState<Guest | null>(null);
  useEffect(() => { let a = true; getGuest(guestId).then((x) => a && setG(x)); return () => { a = false; }; }, [guestId]);
  if (!g) return null;

  const seat = (g.seating_preferences ?? "").toLowerCase();
  const isReturning = (g.total_visits ?? 0) >= 2;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {g.is_vip && <Crown className="h-4 w-4 text-success" />}
          <span>Gastprofiel</span>
        </div>
        {onOpenProfile && (
          <Button size="sm" variant="ghost" className="h-7 text-xs"
            onClick={() => onOpenProfile(g.id)}>
            Bekijk profiel <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
        <span>{g.total_visits ?? 0} bezoeken</span>
        {isReturning && <span className="text-success">Terugkerende gast</span>}
        {g.no_show_count > 0 && (
          <span className="text-warning inline-flex items-center gap-1">
            <BellRing className="h-3 w-3" /> {g.no_show_count} no-show
          </span>
        )}
        {g.preferred_channel && <span>Voorkeur: {g.preferred_channel}</span>}
      </div>

      {g.allergies && (
        <div className="text-xs flex items-start gap-1.5 text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span><span className="font-medium">Allergie:</span> {g.allergies}</span>
        </div>
      )}
      {g.dietary_preferences && (
        <div className="text-xs">
          <span className="text-muted-foreground">Dieet:</span> {g.dietary_preferences}
        </div>
      )}
      {seat && (
        <div className="text-xs flex items-center gap-1.5">
          {seat.includes("terras") ? <Sun className="h-3 w-3" /> : <Leaf className="h-3 w-3" />}
          <span><span className="text-muted-foreground">Voorkeur:</span> {g.seating_preferences}</span>
        </div>
      )}
      {g.hospitality_notes && (
        <div className="text-xs text-muted-foreground italic">"{g.hospitality_notes}"</div>
      )}
    </div>
  );
}
