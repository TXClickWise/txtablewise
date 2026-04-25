import { useEffect, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarDays, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelBadge } from "@/components/ChannelBadge";
import {
  getReservationHistory, getWaitlistHistory, getPreOrderHistory,
} from "@/services/guests";

type Props = { guestId: string; onOpenReservation?: (id: string) => void };

export function GuestReservationHistory({ guestId, onOpenReservation }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reservations, setReservations] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [preOrders, setPreOrders] = useState<Awaited<ReturnType<typeof getPreOrderHistory>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getReservationHistory(guestId),
      getWaitlistHistory(guestId),
      getPreOrderHistory(guestId),
    ]).then(([r, w, p]) => {
      if (!active) return;
      setReservations(r); setWaitlist(w); setPreOrders(p);
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [guestId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Bezoekhistorie ({reservations.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : reservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Deze gast heeft nog geen eerdere reserveringen.</p>
          ) : (
            <ScrollArea className="max-h-72">
              <ul className="divide-y">
                {reservations.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="w-full text-left py-2 flex items-center gap-3 hover:bg-muted/40 -mx-3 px-3 rounded-md"
                      onClick={() => onOpenReservation?.(h.id)}
                    >
                      <div className="min-w-[110px]">
                        <div className="text-sm font-medium">
                          {format(new Date(h.reservation_date), "d MMM yyyy", { locale: nl })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(h.start_time), "HH:mm")} · {h.party_size}p
                        </div>
                      </div>
                      <StatusBadge status={h.status} />
                      <ChannelBadge channel={h.channel} />
                      {h.occasion && (
                        <span className="text-[11px] text-muted-foreground">· {h.occasion}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display">Wachtlijsthistorie ({waitlist.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {waitlist.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen wachtlijst-aanvragen.</p>
          ) : (
            <ul className="divide-y">
              {waitlist.map((w) => (
                <li key={w.id} className="py-2 flex items-center justify-between text-sm">
                  <span>
                    {format(new Date(w.desired_date), "d MMM yyyy", { locale: nl })}
                    {" · "}{w.desired_time_from?.slice(0, 5)}–{w.desired_time_to?.slice(0, 5)}
                    {" · "}{w.party_size}p
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {w.converted_reservation_id ? "Geconverteerd" : w.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Drankjes & extra's ({preOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {preOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen pre-orders eerder.</p>
          ) : (
            <ul className="divide-y">
              {preOrders.slice(0, 10).map((p, i) => (
                <li key={i} className="py-2 text-sm flex items-center justify-between">
                  <span>
                    {format(new Date(p.date), "d MMM yyyy", { locale: nl })} · {p.quantity}× {p.itemName}
                  </span>
                  <span className="text-xs text-muted-foreground">{p.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
