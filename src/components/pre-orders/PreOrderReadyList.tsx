// Floor Mode / dashboard panel: "Klaarzetten" — pre-orders binnen X minuten.
// Inklapbaar; per gast één regel, klikken vouwt items uit.
import { useEffect, useMemo, useState } from "react";
import { format, differenceInMinutes } from "date-fns";
import {
  Clock, MapPin, PackageCheck, Soup, Sparkles, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  changeStatus, getReadyListForToday, type ReadyListEntry,
} from "@/services/preOrders";
import { PreOrderStatusBadge } from "./PreOrderStatusBadge";
import { useCollapsibleGroup } from "@/hooks/useCollapsibleGroup";
import { cn } from "@/lib/utils";

type Props = {
  restaurantId: string;
  date?: string;
  windowMinutes?: number;
  onOpenReservation?: (reservationId: string) => void;
  compact?: boolean;
};

type GuestGroup = {
  reservationId: string;
  startTime: string;
  partySize: number;
  guestName: string;
  tableLabels: string[];
  entries: ReadyListEntry[];
};

export function PreOrderReadyList({
  restaurantId, date, windowMinutes = 60, onOpenReservation, compact,
}: Props) {
  const today = date ?? format(new Date(), "yyyy-MM-dd");
  const [entries, setEntries] = useState<ReadyListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { open: cardOpen, toggle: toggleCard } = useCollapsibleGroup(
    "ready-list",
    true,
  );

  const refresh = async () => {
    setLoading(true);
    try { setEntries(await getReadyListForToday(restaurantId, today)); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (restaurantId) refresh(); /* eslint-disable-next-line */ }, [restaurantId, today]);

  const now = Date.now();
  const visible = useMemo(() => entries.filter((e) => {
    if (e.preOrder.status === "served" || e.preOrder.status === "cancelled") return false;
    const mins = differenceInMinutes(new Date(e.startTime), now);
    return mins <= windowMinutes;
  }), [entries, now, windowMinutes]);

  const groups = useMemo<GuestGroup[]>(() => {
    const map = new Map<string, GuestGroup>();
    for (const e of visible) {
      const g = map.get(e.reservationId);
      if (g) {
        g.entries.push(e);
      } else {
        map.set(e.reservationId, {
          reservationId: e.reservationId,
          startTime: e.startTime,
          partySize: e.partySize,
          guestName: e.guestName,
          tableLabels: e.tableLabels,
          entries: [e],
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }, [visible]);

  const setStatus = async (id: string, next: "prepared" | "served") => {
    setBusyId(id);
    try { await changeStatus(restaurantId, id, next); await refresh(); }
    catch { toast.error("Status kon niet worden bijgewerkt."); }
    finally { setBusyId(null); }
  };

  const toggleGuest = (id: string) =>
    setExpanded((s) => ({ ...s, [id]: !s[id] }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={toggleCard}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={cardOpen}
        >
          <div>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Klaarzetten
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Drankjes en extra's binnen {windowMinutes} min.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {groups.length > 0 && (
              <span>{groups.length} {groups.length === 1 ? "gast" : "gasten"}</span>
            )}
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", cardOpen ? "" : "-rotate-90")}
            />
          </div>
        </button>
      </CardHeader>
      {cardOpen && (
        <CardContent className="pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Er hoeft op dit moment niets klaar gezet te worden.
            </p>
          ) : (
            <ScrollArea className={compact ? "h-[280px]" : "h-[420px]"}>
              <ul className="space-y-2 pr-2">
                {groups.map((g) => {
                  const start = new Date(g.startTime);
                  const mins = differenceInMinutes(start, now);
                  const isOpen = !!expanded[g.reservationId];
                  const itemCount = g.entries.reduce((s, e) => s + (e.preOrder.quantity || 1), 0);
                  return (
                    <li key={g.reservationId} className="rounded-lg border bg-muted/30">
                      <button
                        type="button"
                        onClick={() => toggleGuest(g.reservationId)}
                        className="w-full text-left p-3 flex items-start gap-2 hover:bg-muted/50 rounded-lg"
                        aria-expanded={isOpen}
                      >
                        {isOpen
                          ? <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span className="font-mono">{format(start, "HH:mm")}</span>
                            <span>· {g.partySize}p</span>
                            {g.tableLabels.length > 0 && (
                              <>
                                <MapPin className="h-3 w-3 ml-1" />
                                <span>{g.tableLabels.join(", ")}</span>
                              </>
                            )}
                            <span className="ml-1">
                              {mins >= 0 ? `over ${mins}m` : `${Math.abs(mins)}m geleden`}
                            </span>
                          </div>
                          <div className="text-sm font-medium mt-0.5">{g.guestName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {g.entries.length} {g.entries.length === 1 ? "wens" : "wensen"}
                            {itemCount !== g.entries.length ? ` · ${itemCount} stuks` : ""}
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3 space-y-2 border-t pt-3">
                          {g.entries.map((e) => (
                            <div key={e.preOrder.id} className="rounded-md border bg-background p-2.5 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm min-w-0">
                                  <div>
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
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      )}
    </Card>
  );
}
