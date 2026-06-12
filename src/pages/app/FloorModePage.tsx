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
import { ReservationDatePicker } from "@/components/reservations/ReservationDatePicker";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw, Sparkles, UserPlus, Users, Clock, Crown, Beer,
  AlertTriangle, MapPin, ListChecks, ChevronRight, ChevronLeft, Search,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { WalkInQuickSheet } from "@/components/walk-in/WalkInQuickSheet";
import { StatusBadge } from "@/components/StatusBadge";
import { ReservationBadges } from "@/components/reservations/ReservationBadges";
import { ReservationStatusQuickBar } from "@/components/reservations/ReservationStatusQuickBar";
import { MoveReservationSheet } from "@/components/reservations/MoveReservationSheet";
import { PacingIndicator, pacingLevelFromCovers } from "@/components/reservations/PacingIndicator";
import { AIQuickSeatSheet } from "@/components/floor-plan/AIQuickSeatSheet";
import { LastMinuteFillPanel } from "@/components/waitlist/LastMinuteFillPanel";
import { PreOrderReadyList } from "@/components/pre-orders/PreOrderReadyList";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIsCompact } from "@/hooks/use-breakpoint";
import { WeatherPill } from "@/components/weather/WeatherPill";

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
  free:        "bg-table-free border-l-[4px] border-table-free-border hover:brightness-95",
  expected:    "bg-table-expected border-l-[4px] border-table-expected-border/70",
  soon:        "bg-table-arriving border-l-[4px] border-table-arriving-border",
  arrived:     "bg-table-arriving border-l-[4px] border-table-arriving-border",
  seated:      "bg-table-seated border-l-[4px] border-table-seated-border",
  almostFree:  "bg-table-almost-done border-l-[4px] border-table-almost-done-border",
  overdue:     "bg-table-overtime border-l-[4px] border-table-overtime-border",
  blocked:     "blocked-stripe border-l-[4px] border-table-blocked-border",
};

const CELL_PULSE: Partial<Record<CellStatus, true>> = {
  seated: true,
  overdue: true,
};

const CELL_DOT: Record<CellStatus, string> = {
  free:        "bg-table-free-border",
  expected:    "bg-table-expected-border",
  soon:        "bg-table-arriving-border",
  arrived:     "bg-table-arriving-border",
  seated:      "bg-table-seated-border",
  almostFree:  "bg-table-almost-done-border",
  overdue:     "bg-table-overtime-border",
  blocked:     "bg-table-blocked-border",
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

  const [clockNow, setClockNow] = useState(() => new Date());
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
  const isToday = isSameDay(selectedDate, clockNow);
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  // For status comparisons (overdue/seated/etc.) anchor to start-of-day on
  // non-today views so the timeline renders as a static planning view.
  const now = isToday ? clockNow : startOfDay(selectedDate);
  const today = dateStr; // backward-compat alias used below
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [quickSeatOpen, setQuickSeatOpen] = useState(false);
  const [prefilledTable, setPrefilledTable] = useState<{ id: string; label: string } | undefined>();
  const isCompact = useIsCompact();

  // tick every 30s — keeps timers/late labels fresh without thrashing renders
  useEffect(() => {
    const id = setInterval(() => setClockNow(new Date()), 30_000);
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

  const alertCount = lateGuests.length;
  const upcomingAlertCount = upcoming30.length;

  return (
    <div className="min-h-[calc(100vh-3rem)] flex flex-col bg-muted/10">
      {/* ============== COMPACTE HEADER ============== */}
      <header className="border-b border-border bg-background/90 backdrop-blur px-3 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground capitalize">
            <span>{format(selectedDate, "EEEE d MMMM", { locale: nl })}</span>
            {isToday && <span className="font-mono">· {format(clockNow, "HH:mm")}</span>}
            {!isToday && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                Planning
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon" className="h-9 w-9"
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              aria-label="Vorige dag"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <ReservationDatePicker value={selectedDate} onChange={setSelectedDate} restaurantId={restaurantId} />
            <Button
              variant="outline" size="icon" className="h-9 w-9"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              aria-label="Volgende dag"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isToday && (
              <Button variant="outline" size="sm" className="h-9" onClick={() => setSelectedDate(new Date())}>
                Vandaag
              </Button>
            )}
            <Button
              variant="ghost" size="icon" className="h-9 w-9"
              onClick={() => refetch()} title="Vernieuwen" aria-label="Vernieuwen"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            {restaurantId && <WeatherPill restaurantId={restaurantId} />}
          </div>
        </div>
        {isError && (
          <div className="mt-2 text-sm text-destructive flex items-center gap-2">
            Verbinding hapert.
            <Button size="sm" variant="outline" onClick={() => refetch()}>Opnieuw proberen</Button>
          </div>
        )}
        {/* Compacte alerts (alleen relevant getoond) */}
        {(alertCount > 0 || upcomingAlertCount > 0) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {alertCount > 0 && (
              <button
                type="button"
                onClick={() => focusReservation(lateGuests[0], setSelectedTableId)}
                className="text-xs px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/30 inline-flex items-center gap-1.5 hover:bg-destructive/15"
              >
                <AlertTriangle className="h-3 w-3" />
                {alertCount} {alertCount === 1 ? "gast" : "gasten"} te laat
              </button>
            )}
            {upcomingAlertCount > 0 && (
              <button
                type="button"
                onClick={() => upcoming30[0] && focusReservation(upcoming30[0].r, setSelectedTableId)}
                className="text-xs px-2.5 py-1 rounded-full bg-status-pending/10 text-status-pending border border-status-pending/30 inline-flex items-center gap-1.5 hover:bg-status-pending/15"
              >
                <Clock className="h-3 w-3" />
                {upcomingAlertCount} binnen 30 min
              </button>
            )}
          </div>
        )}
      </header>

      {/* ============== BODY: full-width tafelgrid ============== */}
      <main className="flex-1 overflow-auto">
        <div className="p-3 sm:p-4 space-y-4">
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

      {/* Bottom sheet detail (alle viewports) */}
      <Sheet open={!!selectedTableId} onOpenChange={(o) => !o && setSelectedTableId(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
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
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "h-2 w-2 rounded-full shrink-0",
              CELL_DOT[status],
              CELL_PULSE[status] && "status-dot-active",
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <div className="font-display text-xl font-bold leading-none truncate">Tafel {table.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {table.capacity_min}-{table.capacity_max}p
            </div>
          </div>
        </div>
        {status === "free" ? (
          <span className="rounded-full bg-table-free-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-soft">
            VRIJ
          </span>
        ) : (
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded text-white",
            status === "expected" && "bg-table-expected-border text-foreground",
            status === "soon" && "bg-table-arriving-border",
            status === "arrived" && "bg-table-arriving-border",
            status === "seated" && "bg-table-seated-border",
            status === "almostFree" && "bg-table-almost-done-border",
            status === "overdue" && "bg-table-overtime-border",
            status === "blocked" && "bg-table-blocked-border text-foreground",
          )}>{CELL_LABEL[status]}</span>
        )}
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
          {active && (
            <div className="rounded-lg border-2 border-primary/20 bg-card shadow-sm p-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status wijzigen
              </div>
              <ReservationStatusQuickBar
                reservationId={active.id}
                status={active.status}
                size="lg"
                layout="grid"
              />
            </div>
          )}

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

      <MoveReservationButton
        reservationId={r.id}
        startTimeIso={r.start_time}
      />
    </div>
  );
}

function MoveReservationButton({ reservationId, startTimeIso }: { reservationId: string; startTimeIso: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="lg"
        variant="outline"
        className="w-full h-14"
        onClick={() => setOpen(true)}
      >
        <ChevronRight className="mr-2 h-5 w-5" /> Verplaats reservering
      </Button>
      <MoveReservationSheet
        reservationId={reservationId}
        initialDate={format(new Date(startTimeIso), "yyyy-MM-dd")}
        initialTime={format(new Date(startTimeIso), "HH:mm")}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export default FloorModePage;
