// Floor Mode / dashboard panel: "Klaarzetten" — pre-orders binnen X minuten.
import { useEffect, useState } from "react";
import { format, differenceInMinutes } from "date-fns";
import { Clock, MapPin, PackageCheck, Soup, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  changeStatus, getReadyListForToday, type ReadyListEntry,
} from "@/services/preOrders";
import { PreOrderStatusBadge } from "./PreOrderStatusBadge";

type Props = {
  restaurantId: string;
  date?: string;             // yyyy-MM-dd, default today
  windowMinutes?: number;    // toon alleen items binnen X minuten (default 60)
  onOpenReservation?: (reservationId: string) => void;
  compact?: boolean;
};

export function PreOrderReadyList({
  restaurantId, date, windowMinutes = 60, onOpenReservation, compact,
}: Props) {
  const today = date ?? format(new Date(), "yyyy-MM-dd");
  const [entries, setEntries] = useState<ReadyListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try { setEntries(await getReadyListForToday(restaurantId, today)); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (restaurantId) refresh(); /* eslint-disable-next-line */ }, [restaurantId, today]);

  const now = Date.now();
  const visible = entries.filter((e) => {
    if (e.preOrder.status === "served" || e.preOrder.status === "cancelled") return false;
    const mins = differenceInMinutes(new Date(e.startTime), now);
    return mins <= windowMinutes; // alles tot windowMinutes vooruit (en alle al gepasseerde maar nog niet served)
  });

  const setStatus = async (id: string, next: "prepared" | "served") => {
    setBusyId(id);
    try { await changeStatus(restaurantId, id, next); await refresh(); }
    catch { toast.error("Status kon niet worden bijgewerkt."); }
    finally { setBusyId(null); }
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Klaarzetten
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drankjes en extra's binnen {windowMinutes} min.
          </p>
        </div>
        {visible.length > 0 && (
          <span className="text-xs text-muted-foreground">{visible.length}</span>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Er hoeft op dit moment niets klaar gezet te worden.
          </p>
        ) : (
          <ScrollArea className={compact ? "h-[280px]" : "h-[420px]"}>
            <ul className="space-y-2 pr-2">
              {visible.map((e) => {
                const start = new Date(e.startTime);
                const mins = differenceInMinutes(start, now);
                return (
                  <li key={e.preOrder.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="font-mono">{format(start, "HH:mm")}</span>
                          <span>· {e.partySize}p</span>
                          {e.tableLabels.length > 0 && (
                            <>
                              <MapPin className="h-3 w-3 ml-1" />
                              <span>{e.tableLabels.join(", ")}</span>
                            </>
                          )}
                          <span className="ml-1">{mins >= 0 ? `over ${mins}m` : `${Math.abs(mins)}m geleden`}</span>
                        </div>
                        <div className="text-sm font-medium mt-0.5">{e.guestName}</div>
                        <div className="text-sm">
                          {e.preOrder.quantity}× <span className="font-medium">{e.preOrder.item_name}</span>
                        </div>
                        {e.preOrder.note && (
                          <div className="text-xs text-muted-foreground mt-0.5">{e.preOrder.note}</div>
                        )}
                      </div>
                      <PreOrderStatusBadge status={e.preOrder.status} />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {e.preOrder.status !== "prepared" && e.preOrder.status !== "served" && (
                        <Button size="sm" variant="secondary" className="h-9 min-w-[88px]"
                          disabled={busyId === e.preOrder.id} onClick={() => setStatus(e.preOrder.id, "prepared")}>
                          <PackageCheck className="h-3.5 w-3.5 mr-1" /> Klaar
                        </Button>
                      )}
                      {e.preOrder.status !== "served" && (
                        <Button size="sm" className="h-9 min-w-[88px]"
                          disabled={busyId === e.preOrder.id} onClick={() => setStatus(e.preOrder.id, "served")}>
                          <Soup className="h-3.5 w-3.5 mr-1" /> Geserveerd
                        </Button>
                      )}
                      {onOpenReservation && (
                        <Button size="sm" variant="ghost" className="h-9 ml-auto"
                          onClick={() => onOpenReservation(e.reservationId)}>
                          Detail
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
