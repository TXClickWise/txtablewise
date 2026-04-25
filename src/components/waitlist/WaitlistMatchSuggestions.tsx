import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { findWaitlistMatches, type WaitlistMatch } from "@/services/waitlist";

type Props = {
  restaurantId: string;
  date: string;
  startTime: string;
  partySize: number;
  zoneId?: string | null;
  onPickEntry?: (entryId: string) => void;
};

/**
 * Compact suggestion card used after a reservation is freed up
 * (cancellation / no-show). Pure UI — operator decides what to do.
 */
export function WaitlistMatchSuggestions({
  restaurantId, date, startTime, partySize, zoneId, onPickEntry,
}: Props) {
  const [matches, setMatches] = useState<WaitlistMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    findWaitlistMatches({ restaurantId, date, startTime, partySize, zoneId })
      .then((res) => { if (!cancelled) setMatches(res); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [restaurantId, date, startTime, partySize, zoneId]);

  if (loading) return null;

  return (
    <Card className="p-4 border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="font-medium text-sm">Wachtlijstkans</h4>
      </div>
      {matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Geen passende wachtlijstmatch gevonden voor dit tijdslot.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Er zijn mogelijk gasten op de wachtlijst die deze plek willen overnemen.
          </p>
          <div className="space-y-2">
            {matches.slice(0, 4).map((m) => (
              <div
                key={m.entry.id}
                className="flex items-center justify-between gap-2 rounded-md bg-background p-2 border"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {m.entry.first_name} {m.entry.last_name || ""}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {m.entry.party_size}p
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        m.score === "high"
                          ? "border-status-confirmed/40 text-status-confirmed"
                          : m.score === "medium"
                          ? "border-warning/40 text-warning"
                          : "border-border text-muted-foreground"
                      }
                    >
                      {m.score === "high" ? "Sterke match" : m.score === "medium" ? "Mogelijke match" : "Zwakke match"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{m.reason}</p>
                </div>
                {onPickEntry && (
                  <Button size="sm" variant="outline" onClick={() => onPickEntry(m.entry.id)}>
                    Bekijken
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
