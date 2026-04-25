import { useEffect, useMemo, useState } from "react";
import { format, differenceInMinutes } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  UserPlus, Check, LogOut, UserX, Move, RefreshCw, Clock, Users, Crown, Sparkles,
} from "lucide-react";
import { WalkInDialog } from "@/components/WalkInDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { AIQuickSeatSheet } from "@/components/floor-plan/AIQuickSeatSheet";

type Zone = { id: string; name: string };
type Table = {
  id: string; label: string; zone_id: string | null;
  capacity_min: number; capacity_max: number;
  pos_x: number; pos_y: number; width: number; height: number; shape: string;
  combinable: boolean;
};
type Res = {
  id: string; start_time: string; end_time: string; status: string; party_size: number;
  guests: { first_name: string; last_name: string | null; is_vip: boolean } | null;
  reservation_tables: { table_id: string }[];
};

type TableStatus = "free" | "soon" | "later" | "seated" | "overdue";
const STATUS_ORDER: Record<TableStatus, number> = { overdue: 5, seated: 4, soon: 3, later: 2, free: 1 };

const FloorPlanPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [quickSeatOpen, setQuickSeatOpen] = useState(false);
  const [prefilledTable, setPrefilledTable] = useState<{ id: string; label: string } | undefined>();
  const [now, setNow] = useState(() => new Date());
  const today = format(now, "yyyy-MM-dd");

  // Tick every minute so colors/timers update.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data: zones = [] } = useQuery({
    queryKey: ["zones", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("zones").select("id, name")
        .eq("restaurant_id", restaurantId!).eq("is_active", true).order("sort_order");
      return (data ?? []) as Zone[];
    },
  });

  useEffect(() => { if (!zoneId && zones.length > 0) setZoneId(zones[0].id); }, [zones, zoneId]);

  const { data: tables = [] } = useQuery({
    queryKey: ["tables", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("tables").select("*")
        .eq("restaurant_id", restaurantId!).eq("is_active", true);
      return (data ?? []) as Table[];
    },
  });

  const { data: reservations = [], refetch } = useQuery({
    queryKey: ["floor-reservations", restaurantId, today],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("reservations")
        .select("id, start_time, end_time, status, party_size, guests(first_name, last_name, is_vip), reservation_tables(table_id)")
        .eq("restaurant_id", restaurantId!).eq("reservation_date", today)
        .in("status", ["confirmed", "seated", "pending"]);
      return (data ?? []) as unknown as Res[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase.channel(`floormode-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ["floor-reservations", restaurantId, today] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "reservation_tables" },
        () => qc.invalidateQueries({ queryKey: ["floor-reservations", restaurantId, today] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, qc, today]);

  // Map: table_id -> dominant reservation
  const tableState = useMemo(() => {
    const map = new Map<string, { status: TableStatus; res?: Res }>();
    for (const t of tables) map.set(t.id, { status: "free" });
    for (const r of reservations) {
      const start = new Date(r.start_time);
      const end = new Date(r.end_time);
      let kind: TableStatus;
      if (r.status === "seated") {
        kind = end < now ? "overdue" : "seated";
      } else if (now >= start && now < end) {
        kind = "seated"; // confirmed during window = effectively at-table soon
      } else if (start > now && start.getTime() - now.getTime() < 60 * 60_000) {
        kind = "soon";
      } else if (start > now) {
        kind = "later";
      } else {
        continue; // past, not seated
      }
      for (const rt of r.reservation_tables) {
        const existing = map.get(rt.table_id);
        if (!existing || STATUS_ORDER[kind] > STATUS_ORDER[existing.status]) {
          map.set(rt.table_id, { status: kind, res: r });
        }
      }
    }
    return map;
  }, [tables, reservations, now]);

  // Upcoming arrivals (next 60 min, not yet seated, anywhere in restaurant)
  const upcoming = useMemo(() => {
    return reservations
      .filter((r) => r.status !== "seated")
      .filter((r) => {
        const start = new Date(r.start_time);
        const diff = start.getTime() - now.getTime();
        return diff > -10 * 60_000 && diff < 60 * 60_000;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [reservations, now]);

  const visibleTables = tables.filter((t) => t.zone_id === zoneId);
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;
  const selectedState = selectedTableId ? tableState.get(selectedTableId) : undefined;

  // Action handlers
  const setReservationStatus = async (id: string, status: string) => {
    const patch: { status: string; no_show_marked_at?: string } = { status };
    if (status === "no_show") patch.no_show_marked_at = new Date().toISOString();
    const { error } = await supabase.from("reservations").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    const labels: Record<string, string> = {
      seated: "Aan tafel gezet",
      finished: "Tafel vrijgegeven",
      completed: "Bezoek afgerond",
      no_show: "No-show genoteerd",
      confirmed: "Aangekomen — wacht op tafel",
    };
    toast.success(labels[status] ?? "Bijgewerkt");
    refetch();
  };

  const colorFor = (s: TableStatus): string => {
    switch (s) {
      case "seated":  return "bg-status-seated/15 border-status-seated text-status-seated";
      case "overdue": return "bg-status-noshow/15 border-status-noshow text-status-noshow animate-pulse";
      case "soon":    return "bg-status-pending/15 border-status-pending text-status-pending";
      case "later":   return "bg-secondary border-border text-secondary-foreground";
      default:        return "bg-card border-border text-muted-foreground hover:border-primary/40";
    }
  };

  if (!restaurantId) return null;

  if (tables.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <p>Nog geen tafels geconfigureerd.</p>
            <p className="text-sm">Voeg tafels toe via <strong>Instellingen → Zones &amp; Tafels</strong>, en plaats ze visueel via het tabblad <strong>Plattegrond</strong>.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-muted/10">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl">Floor Mode</h1>
          <span className="text-sm text-muted-foreground capitalize hidden sm:inline">
            {format(now, "EEEE d MMMM · HH:mm", { locale: nl })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => refetch()} title="Vernieuwen">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline" size="lg" className="h-12 px-4 hidden sm:inline-flex"
            onClick={() => setQuickSeatOpen(true)}
            title="AI Quick Seat"
          >
            <Sparkles className="mr-2 h-5 w-5 text-primary" /> AI Quick Seat
          </Button>
          <Button
            variant="outline" size="icon" className="h-12 w-12 sm:hidden"
            onClick={() => setQuickSeatOpen(true)}
            title="AI Quick Seat"
          >
            <Sparkles className="h-5 w-5 text-primary" />
          </Button>
          <Button size="lg" className="h-12 px-5" onClick={() => { setPrefilledTable(undefined); setWalkInOpen(true); }}>
            <UserPlus className="mr-2 h-5 w-5" /> Walk-in
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Floor plan */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {zones.length > 1 && (
            <div className="px-4 sm:px-6 pt-3">
              <Tabs value={zoneId ?? ""} onValueChange={setZoneId}>
                <TabsList className="h-11">
                  {zones.map((z) => (
                    <TabsTrigger key={z.id} value={z.id} className="h-9 px-4 text-sm">{z.name}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          <div className="flex-1 overflow-auto p-4 sm:p-6">
            <div
              className="relative mx-auto rounded-xl border border-border bg-background shadow-sm"
              style={{ width: 900, height: 560 }}
            >
              {visibleTables.map((t) => {
                const st = tableState.get(t.id) ?? { status: "free" as TableStatus };
                const isRound = t.shape === "round";
                const res = st.res;
                const minutesUntil = res ? Math.round((new Date(res.start_time).getTime() - now.getTime()) / 60_000) : null;
                const minutesSinceSeated = res && st.status === "seated"
                  ? differenceInMinutes(now, new Date(res.start_time))
                  : null;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTableId(t.id)}
                    className={cn(
                      "absolute flex flex-col items-center justify-center border-2 transition-all shadow-sm select-none",
                      "active:scale-95 cursor-pointer",
                      isRound ? "rounded-full" : "rounded-lg",
                      colorFor(st.status),
                    )}
                    style={{ left: t.pos_x, top: t.pos_y, width: t.width, height: t.height }}
                  >
                    <div className="font-display text-base leading-none">{t.label}</div>
                    {res ? (
                      <div className="text-[10px] leading-tight mt-1 text-center px-1 max-w-full truncate">
                        <div className="flex items-center gap-0.5 justify-center">
                          {res.guests?.is_vip && <Crown className="h-2.5 w-2.5" />}
                          <span className="truncate">{res.guests?.first_name ?? "Gast"}</span>
                        </div>
                        <div className="opacity-80">
                          {st.status === "seated"
                            ? `${minutesSinceSeated}m`
                            : `${format(new Date(res.start_time), "HH:mm")} · ${res.party_size}p`}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] opacity-70 mt-0.5">{t.capacity_min}-{t.capacity_max}p</div>
                    )}
                  </button>
                );
              })}
              {visibleTables.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Geen tafels in deze zone.
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground justify-center">
              <Legend className="bg-card border-border" label="Vrij" />
              <Legend className="bg-secondary border-border" label="Later vandaag" />
              <Legend className="bg-status-pending/15 border-status-pending" label="Binnen 1 uur" />
              <Legend className="bg-status-seated/15 border-status-seated" label="Aan tafel" />
              <Legend className="bg-status-noshow/15 border-status-noshow" label="Overtijd" />
            </div>
          </div>
        </div>

        {/* Arrivals rail */}
        <aside className="hidden lg:flex w-80 border-l border-border bg-background flex-col">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-display text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" /> Komende aankomsten
            </h2>
            <p className="text-xs text-muted-foreground">Volgende 60 minuten</p>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Geen aankomsten in dit uur.</p>
            )}
            {upcoming.map((r) => {
              const minutesUntil = Math.round((new Date(r.start_time).getTime() - now.getTime()) / 60_000);
              const isLate = minutesUntil < 0;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    // Selecteer eerste gekoppelde tafel
                    const tid = r.reservation_tables[0]?.table_id;
                    if (tid) setSelectedTableId(tid);
                  }}
                  className="w-full text-left rounded-lg border border-border bg-card hover:border-primary/50 p-3 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium flex items-center gap-1.5">
                      {r.guests?.is_vip && <Crown className="h-3.5 w-3.5 text-warning" />}
                      {r.guests?.first_name} {r.guests?.last_name ?? ""}
                    </div>
                    <span className={cn(
                      "text-xs font-mono px-2 py-0.5 rounded-full",
                      isLate ? "bg-status-noshow/15 text-status-noshow" :
                      minutesUntil < 15 ? "bg-status-pending/15 text-status-pending" :
                      "bg-muted text-muted-foreground",
                    )}>
                      {isLate ? `${Math.abs(minutesUntil)}m te laat` : `${minutesUntil}m`}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <span>{format(new Date(r.start_time), "HH:mm")}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.party_size}p</span>
                    <StatusBadge status={r.status as any} />
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Bottom-sheet voor tafel / reservering */}
      <Sheet open={!!selectedTableId} onOpenChange={(o) => !o && setSelectedTableId(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
          {selectedTable && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="font-display text-2xl flex items-center gap-3">
                  Tafel {selectedTable.label}
                  <span className="text-sm font-normal text-muted-foreground">
                    {selectedTable.capacity_min}-{selectedTable.capacity_max} personen
                  </span>
                </SheetTitle>
                <SheetDescription>
                  {selectedState?.res
                    ? <>Gekoppeld aan {selectedState.res.guests?.first_name} ({selectedState.res.party_size}p)</>
                    : "Geen actieve reservering. Klaar voor walk-in of nieuwe boeking."}
                </SheetDescription>
              </SheetHeader>

              {selectedState?.res ? (
                <ReservationActions
                  res={selectedState.res}
                  tableLabel={selectedTable.label}
                  status={selectedState.status}
                  now={now}
                  onAction={(s) => {
                    setReservationStatus(selectedState.res!.id, s);
                    setSelectedTableId(null);
                  }}
                />
              ) : (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button size="lg" className="h-14" onClick={() => {
                    setPrefilledTable({ id: selectedTable.id, label: selectedTable.label });
                    setSelectedTableId(null);
                    setWalkInOpen(true);
                  }}>
                    <UserPlus className="mr-2 h-5 w-5" /> Walk-in op deze tafel
                  </Button>
                  <Button size="lg" variant="outline" className="h-14" onClick={() => setSelectedTableId(null)} disabled>
                    <Move className="mr-2 h-5 w-5" /> Reservering verplaatsen
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} />
    </div>
  );
};

const Legend = ({ className, label }: { className: string; label: string }) => (
  <div className="flex items-center gap-1.5">
    <div className={cn("h-3 w-3 rounded border", className)} />
    <span>{label}</span>
  </div>
);

function ReservationActions({
  res, tableLabel, status, now, onAction,
}: {
  res: Res; tableLabel: string; status: TableStatus; now: Date;
  onAction: (s: string) => void;
}) {
  const minutesUntil = Math.round((new Date(res.start_time).getTime() - now.getTime()) / 60_000);
  const minutesSeated = differenceInMinutes(now, new Date(res.start_time));

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-medium flex items-center gap-1.5">
            {res.guests?.is_vip && <Crown className="h-4 w-4 text-warning" />}
            {res.guests?.first_name} {res.guests?.last_name ?? ""}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
            <Clock className="h-3 w-3" /> {format(new Date(res.start_time), "HH:mm")}
            <Users className="h-3 w-3 ml-1" /> {res.party_size}p
            <span>· tafel {tableLabel}</span>
          </div>
        </div>
        <StatusBadge status={res.status as any} />
      </div>

      {res.status !== "seated" && (
        <div className="text-sm text-muted-foreground">
          {minutesUntil >= 0
            ? <>Komt over <strong className="text-foreground">{minutesUntil} min</strong>.</>
            : <>Is <strong className="text-status-noshow">{Math.abs(minutesUntil)} min te laat</strong>.</>}
        </div>
      )}
      {res.status === "seated" && (
        <div className="text-sm text-muted-foreground">
          Aan tafel sinds <strong className="text-foreground">{minutesSeated} min</strong>.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {res.status !== "seated" && (
          <>
            <Button size="lg" className="h-14" onClick={() => onAction("seated")}>
              <Check className="mr-2 h-5 w-5" /> Seated
            </Button>
            <Button size="lg" variant="outline" className="h-14" onClick={() => onAction("confirmed")}>
              Aangekomen
            </Button>
          </>
        )}
        {res.status === "seated" && (
          <>
            <Button size="lg" className="h-14" onClick={() => onAction("completed")}>
              <LogOut className="mr-2 h-5 w-5" /> Vertrokken
            </Button>
            <Button size="lg" variant="outline" className="h-14" onClick={() => onAction("finished")}>
              Afgerekend
            </Button>
          </>
        )}
        <Button size="lg" variant="outline" className="h-14 col-span-2 sm:col-span-1" disabled>
          <Move className="mr-2 h-5 w-5" /> Verplaats tafel
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 col-span-2 sm:col-span-1 text-status-noshow border-status-noshow/40 hover:bg-status-noshow/10 hover:text-status-noshow"
          onClick={() => onAction("no_show")}
        >
          <UserX className="mr-2 h-5 w-5" /> No-show
        </Button>
      </div>
    </div>
  );
}

export default FloorPlanPage;
