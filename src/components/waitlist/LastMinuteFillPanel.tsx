import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { WaitlistEntry } from "@/services/waitlist";
import { Sparkles, ArrowRight } from "lucide-react";

type Props = {
  restaurantId: string;
};

/**
 * Dashboard widget summarising last-minute fill opportunities for today.
 * Counts active waitlist entries + recent cancellations/no-shows that
 * could potentially be re-filled.
 */
export function LastMinuteFillPanel({ restaurantId }: Props) {
  const [active, setActive] = useState<WaitlistEntry[]>([]);
  const [freedSlots, setFreedSlots] = useState<number>(0);

  useEffect(() => {
    if (!restaurantId) return;
    const today = format(new Date(), "yyyy-MM-dd");

    supabase
      .from("waitlist_entries")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("desired_date", today)
      .in("status", ["waiting", "matched", "notified"])
      .order("created_at", { ascending: true })
      .limit(5)
      .then(({ data }) => setActive(data || []));

    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("reservation_date", today)
      .in("status", ["cancelled", "no_show"])
      .then(({ count }) => setFreedSlots(count || 0));
  }, [restaurantId]);

  if (active.length === 0 && freedSlots === 0) {
    return null;
  }

  return (
    <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base">Last-minute opvulling</h3>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/app/wachtlijst">
            Naar wachtlijst <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-md bg-background p-3 border">
          <p className="text-xs text-muted-foreground">Actief op wachtlijst</p>
          <p className="text-2xl font-display">{active.length}</p>
        </div>
        <div className="rounded-md bg-background p-3 border">
          <p className="text-xs text-muted-foreground">Vrijgekomen vandaag</p>
          <p className="text-2xl font-display">{freedSlots}</p>
        </div>
      </div>

      {active.length > 0 && (
        <div className="space-y-1.5">
          {active.slice(0, 3).map((e) => (
            <div key={e.id} className="text-sm flex items-center justify-between">
              <span className="truncate">
                {e.first_name} — {e.party_size}p — {e.desired_time_from?.slice(0, 5)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
