import { useEffect, useMemo, useState } from "react";
import { format, differenceInMinutes, addDays, subDays, isSameDay, parseISO, isValid, startOfDay } from "date-fns";
import { nl } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { reservations as resService } from "@/services/reservations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw, Sparkles, UserPlus, Users, Clock, Crown, Beer,
  AlertTriangle, MapPin, Check, LogOut, UserX, ListChecks, ChevronRight, ChevronLeft, Search,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { WalkInQuickSheet } from "@/components/walk-in/WalkInQuickSheet";
import { StatusBadge } from "@/components/StatusBadge";
import { ReservationBadges } from "@/components/reservations/ReservationBadges";
import { PacingIndicator, pacingLevelFromCovers } from "@/components/reservations/PacingIndicator";
import { AIQuickSeatSheet } from "@/components/floor-plan/AIQuickSeatSheet";
import { LastMinuteFillPanel } from "@/components/waitlist/LastMinuteFillPanel";
import { PreOrderReadyList } from "@/components/pre-orders/PreOrderReadyList";
import { useNavigate, useSearchParams } from "react-router-dom";

type Zone = { id: string; name: string };
type Table = {
  id: string; label: string; zone_id: string | null;
  capacity_min: number; capacity_max: number;
  pos_x: number; pos_y: number; width: number; height: number; shape: string;
  combinable: boolean;
};
type Res = {
  id: string;
  start_time: string; end_time: string;
  status: string; party_size: number;
  occasion: string | null;
  dietary_notes: string | null;
  internal_notes: string | null;
  reminder_confirmed_at: string | null;
  large_group_status: string | null;
  requires_manual_approval: boolean;
  channel: string;
  guests: { first_name: string | null; last_name: string | null; is_vip: boolean; allergies: string | null } | null;
  reservation_tables: { table_id: string }[];
  pre_orders: { id: string }[];
};

type CellStatus =
  | "free"        // niets te doen
  | "expected"    // reservering komt eraan (>15m)
  | "soon"        // <15m of net binnen
  | "arrived"     // gast aangekomen, nog niet seated (status=confirmed binnen window)
  | "seated"
  | "almostFree"  // seated, eindtijd binnen 15m
  | "overdue"     // seated, eindtijd voorbij
  | "blocked";    // toekomstige uitbreiding

const CELL_TONE: Record<CellStatus, string> = {
  free:        "bg-card border-border hover:border-primary/40",
  expected:    "bg-secondary border-border",
  soon:        "bg-status-pending/10 border-status-pending/40",
  arrived:     "bg-status-pending/15 border-status-pending",
  seated:      "bg-status-seated/10 border-status-seated/40",
  almostFree:  "bg-warning/10 border-warning/40",
  overdue:     "bg-status-noshow/10 border-status-noshow/50",
  blocked:     "bg-muted border-border opacity-70",
};

const CELL_LABEL: Record<CellStatus, string> = {
  free:        "Vrij",
  expected:    "Verwacht",
  soon:        "Komt zo",
  arrived:     "Gearriveerd",
  seated:      "Aan tafel",
  almostFree:  "Bijna vrij",
  overdue:     "Overtijd",
  blocked:     "Geblokkeerd",
};

const FloorModePage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const restaurant = (current as any)?.restaurants ?? {};
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [now, setNow] = useState(() => new Date());
  const initialSelected = (() => {
    const p = searchParams.get("date");
    if (p) {
      const d = parseISO(p);
      if (isValid(d)) return d;
    }
    return new Date();
  })();
  const [selectedDate, setSelectedDateState] = useState<Date>(initialSelected);
  const setSelectedDate = (d: Date) => {
    setSelectedDateState(d);
    const next = new URLSearchParams(searchParams);
    if (isSameDay(d, new Date())) next.delete("date");
    else next.set("date", format(d, "yyyy-MM-dd"));
    setSearchParams(next, { replace: true });
  };
  const isToday = isSameDay(selectedDate, now);
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  // Reference time used for status calculations (overdue/almostFree/etc).
  // On non-today views we anchor to start-of-day so nothing appears "live".
  const referenceTime = isToday ? now : startOfDay(selectedDate);
  const today = dateStr; // backward-compat alias used below
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [quickSeatOpen, setQuickSeatOpen] = useState(false);
  const [prefilledTable, setPrefilledTable] = useState<{ id: string; label: string } | undefined>();

  // tick every 30s — keeps timers/late labels fresh without thrashing renders
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
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

  const { data: tables = [] } = useQuery({
    queryKey: ["tables", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("tables").select("*")
        .eq("restaurant_id", restaurantId!).eq("is_active", true);
      return (data ?? []) as Table[];
    },
  });

  const { data: reservations = [], refetch, isFetching, isError } = useQuery({
    queryKey: ["floor-mode-reservations", restaurantId, today],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(`
          id, start_time, end_time, status, party_size, occasion, dietary_notes,
          internal_notes, reminder_confirmed_at, large_group_status, requires_manual_approval,
          channel,
          guests(first_name, last_name, is_vip, allergies),
          reservation_tables(table_id),
          pre_orders(id)
        `)
        .eq("restaurant_id", restaurantId!)
        .eq("reservation_date", today)
        .in("status", ["pending", "confirmed", "seated"]);
      if (error) throw error;
      return (data ?? []) as unknown as Res[];
    },
  });

  // mark "last updated" whenever fresh data arrives
  useEffect(() => { if (!isFetching) setLastUpdated(new Date()); }, [isFetching, reservations]);

  // realtime: invalidate on any reservation/table-link change for this restaurant
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase.channel(`floor-mode-${restaurantId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ["floor-mode-reservations", restaurantId, today] }))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "reservation_tables" },
        () => qc.invalidateQueries({ queryKey: ["floor-mode-reservations", restaurantId, today] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, qc, today]);

  // Compute per-table status + active reservation + next reservation
  const tableState = useMemo(() => {
    type State = { status: CellStatus; active?: Res; next?: Res };
    const map = new Map<string, State>();
    for (const t of tables) map.set(t.id, { status: "free" });

    // group reservations by table
    const byTable = new Map<string, Res[]>();
    for (const r of reservations) {
      for (const rt of r.reservation_tables) {
        const arr = byTable.get(rt.table_id) ?? [];
        arr.push(r);
        byTable.set(rt.table_id, arr);
      }
    }

    for (const [tableId, list] of byTable) {
      list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      let active: Res | undefined;
      let next: Res | undefined;
      for (const r of list) {
        const start = new Date(r.start_time);
        const end = new Date(r.end_time);
        if (r.status === "seated") { active = r; continue; }
        if (now >= start && now < end) { active = active ?? r; continue; }
        if (start > now && !next) next = r;
      }

      let status: CellStatus = "free";
      if (active) {
        if (active.status === "seated") {
          const minToEnd = differenceInMinutes(new Date(active.end_time), now);
          if (minToEnd < 0) status = "overdue";
          else if (minToEnd <= 15) status = "almostFree";
          else status = "seated";
        } else if (active.status === "confirmed") {
          // confirmed during window = aangekomen wachtend op seating
          status = "arrived";
        } else {
          status = "soon";
        }
      } else if (next) {
        const minTo = differenceInMinutes(new Date(next.start_time), now);
        status = minTo <= 15 ? "soon" : "expected";
      }

      map.set(tableId, { status, active, next });
    }
    return map;
  }, [tables, reservations, now]);

  // Buckets for the left rail
  const upcoming30 = useMemo(() => reservations
    .filter(r => r.status === "pending" || r.status === "confirmed")
    .map(r => ({ r, mins: differenceInMinutes(new Date(r.start_time), now) }))
    .filter(({ mins }) => mins >= -10 && mins <= 30)
    .sort((a, b) => a.mins - b.mins),
    [reservations, now]);

  const lateGuests = useMemo(() => reservations
    .filter(r => (r.status === "pending" || r.status === "confirmed"))
    .filter(r => differenceInMinutes(now, new Date(r.start_time)) >= 10),
    [reservations, now]);

  const largeGroupThreshold = restaurant?.large_group_threshold ?? 9;

  const largeGroupsToday = useMemo(() => reservations
    .filter(r => r.party_size >= largeGroupThreshold)
    .filter(r => r.status !== "seated")
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [reservations, largeGroupThreshold]);

  const preorderToday = useMemo(() => reservations
    .filter(r => r.pre_orders && r.pre_orders.length > 0)
    .filter(r => r.status !== "completed" && r.status !== "cancelled")
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [reservations]);

  // KPIs
  const totalToday = reservations.length;
  const seatedNow = reservations.filter(r => r.status === "seated").length;
  const walkInsToday = reservations.filter(r => r.channel === "walk_in").length;
  const tablesFree = tables.filter(t => (tableState.get(t.id)?.status ?? "free") === "free").length;

  const coversNextHour = useMemo(() =>
    reservations
      .filter(r => r.status !== "cancelled")
      .filter(r => {
        const start = new Date(r.start_time).getTime();
        return start >= now.getTime() && start <= now.getTime() + 60 * 60_000;
      })
      .reduce((sum, r) => sum + r.party_size, 0),
    [reservations, now]);

  const totalCapacity = tables.reduce((s, t) => s + t.capacity_max, 0);
  const pacingLevel = pacingLevelFromCovers(coversNextHour, totalCapacity || null);

  const selectedTable = tables.find(t => t.id === selectedTableId) ?? null;
  const selectedState = selectedTableId ? tableState.get(selectedTableId) : undefined;

  // ---------- Actions (all routed through reservations service) ----------
  const runAction = async (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMsg: string,
  ) => {
    const res = await fn();
    if (!res.ok) {
      toast.error(res.error ?? "Actie mislukt. Probeer het opnieuw.");
      return false;
    }
    toast.success(successMsg);
    qc.invalidateQueries({ queryKey: ["floor-mode-reservations", restaurantId, today] });
    return true;
  };

  const onMarkSeated   = (id: string) => runAction(() => resService.markSeated(id),   "Gast aan tafel gezet");
  const onMarkArrived  = (id: string) => runAction(() => resService.changeStatus(id, "confirmed"), "Aangekomen genoteerd");
  const onMarkComplete = (id: string) => runAction(() => resService.markCompleted(id), "Bezoek afgerond — tafel vrij");
  const onMarkNoShow   = (id: string) => runAction(() => resService.markNoShow(id),    "No-show genoteerd");

  if (!restaurantId) return null;

  if (tables.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <p>Nog geen tafels geconfigureerd.</p>
            <p className="text-sm">
              Voeg eerst tafels toe via <strong>Instellingen → Zones &amp; Tafels</strong>.
            </p>
            <Button className="mt-4" onClick={() => navigate("/app/instellingen")}>
              Naar instellingen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-muted/10">
      {/* ============== HEADER ============== */}
      <header className="border-b border-border bg-background/90 backdrop-blur px-4 sm:px-6 py-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="font-display text-2xl">Floor Mode</h1>
              <span className="text-sm text-muted-foreground capitalize">
                {format(now, "EEEE d MMMM · HH:mm", { locale: nl })}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
              <Kpi label="reserveringen" value={totalToday} />
              <Kpi label="aan tafel" value={seatedNow} tone="seated" />
              <Kpi label="walk-ins" value={walkInsToday} />
              <Kpi label="tafels vrij" value={tablesFree} tone="success" />
              <PacingIndicator level={pacingLevel} covers={coversNextHour} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-muted-foreground" aria-live="polite">
              Laatst bijgewerkt {format(lastUpdated, "HH:mm:ss")}
            </span>
            <Button
              variant="ghost" size="icon" onClick={() => refetch()} title="Vernieuwen"
              aria-label="Vernieuwen"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button
              variant="outline" size="lg" className="h-12"
              onClick={() => setQuickSeatOpen(true)}
              title="AI Quick Seat"
            >
              <Sparkles className="mr-2 h-5 w-5 text-primary" />
              <span className="hidden sm:inline">AI Quick Seat</span>
            </Button>
            <Button
              size="lg" className="h-12 px-5"
              onClick={() => { setPrefilledTable(undefined); setWalkInOpen(true); }}
            >
              <UserPlus className="mr-2 h-5 w-5" /> Walk-in
            </Button>
          </div>
        </div>
        {isError && (
          <div className="mt-2 text-sm text-destructive flex items-center gap-2">
            Verbinding hapert.
            <Button size="sm" variant="outline" onClick={() => refetch()}>Opnieuw proberen</Button>
          </div>
        )}
      </header>

      {/* ============== BODY ============== */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Now & soon */}
        <aside className="hidden lg:flex w-80 xl:w-96 border-r border-border bg-background flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-lg">Nu &amp; straks</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-5">
              <Section title="Te laat" count={lateGuests.length} tone="danger" empty="Geen te late gasten.">
                {lateGuests.map(r => (
                  <UpcomingRow key={r.id} r={r} now={now} late
                    onSelect={() => focusReservation(r, setSelectedTableId)} />
                ))}
              </Section>

              <Section title="Binnen 30 minuten" count={upcoming30.length} empty="Geen aankomsten in dit halfuur.">
                {upcoming30.map(({ r }) => (
                  <UpcomingRow key={r.id} r={r} now={now}
                    onSelect={() => focusReservation(r, setSelectedTableId)} />
                ))}
              </Section>

              {largeGroupsToday.length > 0 && (
                <Section title="Grote groepen" count={largeGroupsToday.length} tone="warn">
                  {largeGroupsToday.map(r => (
                    <UpcomingRow key={r.id} r={r} now={now}
                      onSelect={() => focusReservation(r, setSelectedTableId)} />
                  ))}
                </Section>
              )}

              {preorderToday.length > 0 && (
                <Section title="Drankje klaarzetten" count={preorderToday.length} tone="info">
                  {preorderToday.map(r => (
                    <UpcomingRow key={r.id} r={r} now={now}
                      onSelect={() => focusReservation(r, setSelectedTableId)} />
                  ))}
                </Section>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* CENTER: Tables grouped by zone */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 space-y-6">
            {restaurantId && <LastMinuteFillPanel restaurantId={restaurantId} />}
            {restaurantId && (
              <PreOrderReadyList
                restaurantId={restaurantId}
                windowMinutes={60}
                compact
              />
            )}
            {zones.length === 0 ? (
              <ZoneBlock
                zoneName="Zonder zone"
                tables={tables}
                state={tableState}
                now={now}
                largeGroupThreshold={largeGroupThreshold}
                selectedId={selectedTableId}
                onSelect={setSelectedTableId}
              />
            ) : (
              <>
                {zones.map(z => {
                  const zTables = tables.filter(t => t.zone_id === z.id);
                  if (zTables.length === 0) return null;
                  return (
                    <ZoneBlock
                      key={z.id}
                      zoneName={z.name}
                      tables={zTables}
                      state={tableState}
                      now={now}
                      largeGroupThreshold={largeGroupThreshold}
                      selectedId={selectedTableId}
                      onSelect={setSelectedTableId}
                    />
                  );
                })}
                {(() => {
                  const ungrouped = tables.filter(t => !t.zone_id);
                  if (ungrouped.length === 0) return null;
                  return (
                    <ZoneBlock
                      zoneName="Overig"
                      tables={ungrouped}
                      state={tableState}
                      now={now}
                      largeGroupThreshold={largeGroupThreshold}
                      selectedId={selectedTableId}
                      onSelect={setSelectedTableId}
                    />
                  );
                })()}
              </>
            )}
          </div>
        </main>

        {/* RIGHT: Detail panel (desktop/landscape only) */}
        <aside className="hidden xl:flex w-96 border-l border-border bg-background flex-col">
          <DetailPanel
            table={selectedTable}
            state={selectedState}
            now={now}
            largeGroupThreshold={largeGroupThreshold}
            onClose={() => setSelectedTableId(null)}
            onWalkIn={() => {
              if (!selectedTable) return;
              setPrefilledTable({ id: selectedTable.id, label: selectedTable.label });
              setWalkInOpen(true);
            }}
            onMarkSeated={onMarkSeated}
            onMarkArrived={onMarkArrived}
            onMarkComplete={onMarkComplete}
            onMarkNoShow={onMarkNoShow}
          />
        </aside>
      </div>

      {/* ============== Sticky bottom action bar (tablet & mobile) ============== */}
      <div className="xl:hidden border-t border-border bg-background/95 backdrop-blur px-3 py-2 flex items-center gap-2 overflow-x-auto">
        <Button size="lg" className="h-12 shrink-0" onClick={() => { setPrefilledTable(undefined); setWalkInOpen(true); }}>
          <UserPlus className="mr-2 h-5 w-5" /> Walk-in
        </Button>
        <Button size="lg" variant="outline" className="h-12 shrink-0" onClick={() => navigate("/app/reserveringen")}>
          <Search className="mr-2 h-5 w-5" /> Zoek reservering
        </Button>
        <Button size="lg" variant="outline" className="h-12 shrink-0" onClick={() => navigate("/app/wachtlijst")}>
          <ListChecks className="mr-2 h-5 w-5" /> Wachtlijst
        </Button>
        <Button size="lg" variant="outline" className="h-12 shrink-0" onClick={() => setQuickSeatOpen(true)}>
          <Sparkles className="mr-2 h-5 w-5 text-primary" /> AI Quick Seat
        </Button>
        <Button size="lg" variant="ghost" className="h-12 shrink-0" onClick={() => refetch()}>
          <RefreshCw className={cn("h-5 w-5", isFetching && "animate-spin")} />
        </Button>
      </div>

      {/* Bottom sheet detail (tablet portrait + mobile) */}
      <Sheet open={!!selectedTableId} onOpenChange={(o) => !o && setSelectedTableId(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] xl:hidden">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl">
              {selectedTable ? `Tafel ${selectedTable.label}` : "Tafel"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            <DetailPanel
              embedded
              table={selectedTable}
              state={selectedState}
              now={now}
              largeGroupThreshold={largeGroupThreshold}
              onClose={() => setSelectedTableId(null)}
              onWalkIn={() => {
                if (!selectedTable) return;
                setPrefilledTable({ id: selectedTable.id, label: selectedTable.label });
                setSelectedTableId(null);
                setWalkInOpen(true);
              }}
              onMarkSeated={(id) => onMarkSeated(id).then(ok => ok && setSelectedTableId(null))}
              onMarkArrived={onMarkArrived}
              onMarkComplete={(id) => onMarkComplete(id).then(ok => ok && setSelectedTableId(null))}
              onMarkNoShow={(id) => onMarkNoShow(id).then(ok => ok && setSelectedTableId(null))}
            />
          </div>
        </SheetContent>
      </Sheet>

      <WalkInQuickSheet
        open={walkInOpen}
        onOpenChange={(o) => { setWalkInOpen(o); if (!o) setPrefilledTable(undefined); }}
        prefill={prefilledTable ? { tableId: prefilledTable.id } : undefined}
      />

      <AIQuickSeatSheet
        open={quickSeatOpen}
        onOpenChange={setQuickSeatOpen}
        zones={zones}
        tables={tables}
        reservations={reservations as any}
        defaultDurationMinutes={restaurant?.default_reservation_minutes ?? 105}
        largeGroupThreshold={largeGroupThreshold}
        largeGroupMinutes={restaurant?.large_group_minutes ?? 150}
        onPick={(table) => {
          setPrefilledTable({ id: table.id, label: table.label });
          setWalkInOpen(true);
        }}
      />
    </div>
  );
};

// ----------------------------------- helpers / subcomponents

function focusReservation(r: Res, setSelectedTableId: (id: string | null) => void) {
  const tid = r.reservation_tables[0]?.table_id;
  if (tid) setSelectedTableId(tid);
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: "seated" | "success" }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <strong className={cn(
        "text-foreground tabular-nums",
        tone === "seated" && "text-status-seated",
        tone === "success" && "text-success",
      )}>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

function Section({
  title, count, tone, empty, children,
}: {
  title: string; count: number; tone?: "danger" | "warn" | "info";
  empty?: string; children: React.ReactNode;
}) {
  const toneClass =
    tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-warning"
    : tone === "info" ? "text-primary"
    : "text-muted-foreground";
  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className={cn("text-xs font-semibold uppercase tracking-wide", toneClass)}>{title}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </div>
      {count === 0 && empty ? (
        <p className="text-xs text-muted-foreground px-1 py-2">{empty}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function UpcomingRow({
  r, now, late, onSelect,
}: { r: Res; now: Date; late?: boolean; onSelect: () => void }) {
  const minutes = differenceInMinutes(new Date(r.start_time), now);
  const lateMin = -minutes;
  const tableId = r.reservation_tables[0]?.table_id;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-colors",
        late
          ? "bg-destructive/5 border-destructive/30 hover:border-destructive/50"
          : "bg-card border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-1.5 font-medium">
          {r.guests?.is_vip && <Crown className="h-4 w-4 text-warning shrink-0" />}
          <span className="truncate">
            {r.guests?.first_name ?? "Gast"} {r.guests?.last_name ?? ""}
          </span>
        </div>
        <span className={cn(
          "text-xs font-mono px-2 py-0.5 rounded-full shrink-0",
          late ? "bg-destructive/15 text-destructive"
            : minutes <= 15 ? "bg-status-pending/15 text-status-pending"
            : "bg-muted text-muted-foreground",
        )}>
          {late ? `${lateMin}m te laat` : `${minutes}m`}
        </span>
      </div>
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
        <span className="font-mono">{format(new Date(r.start_time), "HH:mm")}</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.party_size}p</span>
        {tableId && <span className="text-foreground/70">· tafel {tableId.slice(0, 4)}…</span>}
      </div>
      <ReservationBadges
        className="mt-1.5"
        max={3}
        flags={{
          partySize: r.party_size,
          isWalkIn: r.channel === "walk_in",
          isVip: !!r.guests?.is_vip,
          hasAllergy: !!(r.guests?.allergies || r.dietary_notes),
          hasPreOrder: r.pre_orders.length > 0,
          occasion: r.occasion,
          requiresManualApproval: r.requires_manual_approval,
          largeGroupStatus: r.large_group_status,
          reminderConfirmed: !!r.reminder_confirmed_at,
          startTimeIso: r.start_time,
          status: r.status,
        }}
      />
    </button>
  );
}

function ZoneBlock({
  zoneName, tables, state, now, largeGroupThreshold,
  selectedId, onSelect,
}: {
  zoneName: string;
  tables: Table[];
  state: Map<string, { status: CellStatus; active?: Res; next?: Res }>;
  now: Date;
  largeGroupThreshold: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const seated = tables.filter(t => state.get(t.id)?.status === "seated").length;
  const free = tables.filter(t => (state.get(t.id)?.status ?? "free") === "free").length;
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-xl">{zoneName}</h2>
        <p className="text-xs text-muted-foreground">
          {tables.length} tafels · {free} vrij · {seated} aan tafel
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
        {tables.map(t => {
          const st = state.get(t.id) ?? { status: "free" as CellStatus };
          return (
            <TableCard
              key={t.id}
              table={t}
              state={st}
              now={now}
              largeGroupThreshold={largeGroupThreshold}
              selected={selectedId === t.id}
              onSelect={() => onSelect(t.id)}
            />
          );
        })}
      </div>
    </section>
  );
}

function TableCard({
  table, state, now, largeGroupThreshold, selected, onSelect,
}: {
  table: Table;
  state: { status: CellStatus; active?: Res; next?: Res };
  now: Date;
  largeGroupThreshold: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { status, active, next } = state;
  const minSeated = active && active.status === "seated"
    ? differenceInMinutes(now, new Date(active.start_time))
    : null;
  const minToActive = active && active.status !== "seated"
    ? differenceInMinutes(new Date(active.start_time), now)
    : null;
  const minToEnd = active ? differenceInMinutes(new Date(active.end_time), now) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-xl border-2 p-3 transition-all min-h-[112px] active:scale-[0.98]",
        CELL_TONE[status],
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-lg leading-none">Tafel {table.label}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {table.capacity_min}-{table.capacity_max}p
          </div>
        </div>
        <span className={cn(
          "text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded",
          status === "free" && "bg-muted text-muted-foreground",
          status === "expected" && "bg-secondary text-secondary-foreground",
          status === "soon" && "bg-status-pending/20 text-status-pending",
          status === "arrived" && "bg-status-pending/30 text-status-pending",
          status === "seated" && "bg-status-seated/20 text-status-seated",
          status === "almostFree" && "bg-warning/25 text-warning",
          status === "overdue" && "bg-status-noshow/25 text-status-noshow",
          status === "blocked" && "bg-muted text-muted-foreground",
        )}>{CELL_LABEL[status]}</span>
      </div>

      {active ? (
        <div className="mt-2 text-sm">
          <div className="flex items-center gap-1 font-medium truncate">
            {active.guests?.is_vip && <Crown className="h-3.5 w-3.5 text-warning shrink-0" />}
            <span className="truncate">
              {active.guests?.first_name ?? "Gast"} {active.guests?.last_name ?? ""}
            </span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
            <Users className="h-3 w-3" />{active.party_size}p
            {minSeated !== null && <span>· {minSeated}m</span>}
            {minToActive !== null && minToActive >= 0 && <span>· over {minToActive}m</span>}
            {status === "almostFree" && minToEnd !== null && <span>· nog {Math.max(0, minToEnd)}m</span>}
          </div>
          {(active.party_size >= largeGroupThreshold || (active.pre_orders?.length ?? 0) > 0
            || active.guests?.allergies || active.dietary_notes) && (
            <div className="flex items-center gap-1 mt-1.5">
              {active.party_size >= largeGroupThreshold && (
                <span title="Grote groep" className="text-warning"><Users className="h-3.5 w-3.5" /></span>
              )}
              {(active.pre_orders?.length ?? 0) > 0 && (
                <span title="Pre-order" className="text-primary"><Beer className="h-3.5 w-3.5" /></span>
              )}
              {(active.guests?.allergies || active.dietary_notes) && (
                <span title="Allergie" className="text-destructive"><AlertTriangle className="h-3.5 w-3.5" /></span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">
          {next
            ? <>Volgende {format(new Date(next.start_time), "HH:mm")} · {next.guests?.first_name ?? "Gast"} ({next.party_size}p)</>
            : <>Geen reservering vandaag</>}
        </div>
      )}
    </button>
  );
}

function DetailPanel({
  table, state, now, largeGroupThreshold,
  onClose, onWalkIn, onMarkSeated, onMarkArrived, onMarkComplete, onMarkNoShow,
  embedded,
}: {
  table: Table | null;
  state?: { status: CellStatus; active?: Res; next?: Res };
  now: Date;
  largeGroupThreshold: number;
  onClose: () => void;
  onWalkIn: () => void;
  onMarkSeated: (id: string) => Promise<unknown> | unknown;
  onMarkArrived: (id: string) => Promise<unknown> | unknown;
  onMarkComplete: (id: string) => Promise<unknown> | unknown;
  onMarkNoShow: (id: string) => Promise<unknown> | unknown;
  embedded?: boolean;
}) {
  if (!table) {
    return (
      <div className={cn(!embedded && "p-6", "h-full flex items-center justify-center text-center text-muted-foreground")}>
        <div>
          <MapPin className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Selecteer een tafel om acties te tonen.</p>
        </div>
      </div>
    );
  }
  const active = state?.active;
  const next = state?.next;
  const status = state?.status ?? "free";

  return (
    <div className={cn(!embedded && "flex flex-col h-full")}>
      {!embedded && (
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl">Tafel {table.label}</h2>
            <p className="text-xs text-muted-foreground">{table.capacity_min}-{table.capacity_max} personen</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Sluit</Button>
        </div>
      )}

      <ScrollArea className={cn(!embedded && "flex-1")}>
        <div className="p-4 space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <strong className="text-foreground">Status:</strong> {CELL_LABEL[status]}
          </div>

          {active ? (
            <ActiveReservationActions
              r={active}
              now={now}
              largeGroupThreshold={largeGroupThreshold}
              onMarkSeated={onMarkSeated}
              onMarkArrived={onMarkArrived}
              onMarkComplete={onMarkComplete}
              onMarkNoShow={onMarkNoShow}
            />
          ) : (
            <div className="space-y-3">
              <Button size="lg" className="w-full h-14" onClick={onWalkIn}>
                <UserPlus className="mr-2 h-5 w-5" /> Walk-in op deze tafel
              </Button>
              <Button size="lg" variant="outline" className="w-full h-14" disabled title="Komt later">
                <ChevronRight className="mr-2 h-5 w-5" /> Reservering toewijzen
              </Button>
            </div>
          )}

          {next && (
            <div className="rounded-lg border border-dashed border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <strong>Volgende reservering</strong>
                <StatusBadge status={next.status as any} />
              </div>
              <div className="mt-1 text-muted-foreground">
                {format(new Date(next.start_time), "HH:mm")} · {next.guests?.first_name ?? "Gast"} ({next.party_size}p)
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ActiveReservationActions({
  r, now, largeGroupThreshold,
  onMarkSeated, onMarkArrived, onMarkComplete, onMarkNoShow,
}: {
  r: Res; now: Date; largeGroupThreshold: number;
  onMarkSeated: (id: string) => Promise<unknown> | unknown;
  onMarkArrived: (id: string) => Promise<unknown> | unknown;
  onMarkComplete: (id: string) => Promise<unknown> | unknown;
  onMarkNoShow: (id: string) => Promise<unknown> | unknown;
}) {
  const minutesUntil = differenceInMinutes(new Date(r.start_time), now);
  const minutesSeated = r.status === "seated" ? differenceInMinutes(now, new Date(r.start_time)) : null;
  const isSeated = r.status === "seated";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-medium">
              {r.guests?.is_vip && <Crown className="h-4 w-4 text-warning" />}
              <span className="truncate">
                {r.guests?.first_name ?? "Gast"} {r.guests?.last_name ?? ""}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
              <Clock className="h-3 w-3" />
              {format(new Date(r.start_time), "HH:mm")}–{format(new Date(r.end_time), "HH:mm")}
              <Users className="h-3 w-3 ml-1" /> {r.party_size}p
            </div>
          </div>
          <StatusBadge status={r.status as any} />
        </div>
        <ReservationBadges
          className="mt-2"
          flags={{
            partySize: r.party_size,
            isWalkIn: r.channel === "walk_in",
            isVip: !!r.guests?.is_vip,
            hasAllergy: !!(r.guests?.allergies || r.dietary_notes),
            hasPreOrder: r.pre_orders.length > 0,
            occasion: r.occasion,
            largeGroupThreshold,
            requiresManualApproval: r.requires_manual_approval,
            largeGroupStatus: r.large_group_status,
            reminderConfirmed: !!r.reminder_confirmed_at,
            startTimeIso: r.start_time,
            status: r.status,
          }}
        />
        {(r.dietary_notes || r.guests?.allergies) && (
          <div className="mt-2 text-xs rounded bg-destructive/5 border border-destructive/20 p-2 text-destructive">
            <strong>Allergie/dieet:</strong> {r.guests?.allergies ?? r.dietary_notes}
          </div>
        )}
        {r.internal_notes && (
          <div className="mt-2 text-xs rounded bg-muted p-2 text-muted-foreground">
            <strong>Notitie:</strong> {r.internal_notes}
          </div>
        )}
        <div className="mt-2 text-xs text-muted-foreground">
          {!isSeated && (minutesUntil >= 0
            ? <>Komt over <strong className="text-foreground">{minutesUntil} min</strong>.</>
            : <>Is <strong className="text-destructive">{Math.abs(minutesUntil)} min te laat</strong>.</>)}
          {isSeated && minutesSeated !== null && <>Aan tafel sinds <strong className="text-foreground">{minutesSeated} min</strong>.</>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {!isSeated ? (
          <>
            <Button size="lg" className="h-14" onClick={() => onMarkSeated(r.id)}>
              <Check className="mr-2 h-5 w-5" /> Seated
            </Button>
            <Button size="lg" variant="outline" className="h-14" onClick={() => onMarkArrived(r.id)}>
              Aangekomen
            </Button>
          </>
        ) : (
          <Button size="lg" className="col-span-2 h-14" onClick={() => onMarkComplete(r.id)}>
            <LogOut className="mr-2 h-5 w-5" /> Tafel vrijmaken
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="lg" variant="outline"
              className="col-span-2 h-12 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              <UserX className="mr-2 h-5 w-5" /> No-show markeren
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Markeren als no-show?</AlertDialogTitle>
              <AlertDialogDescription>
                Deze gast wordt geregistreerd als no-show. Dit beïnvloedt het gastprofiel en eventuele aanbetalingsregels.
                Je kunt eerst proberen contact op te nemen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Nog wachten</AlertDialogCancel>
              <AlertDialogAction onClick={() => onMarkNoShow(r.id)}>
                No-show bevestigen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default FloorModePage;
