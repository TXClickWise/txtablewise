import { useMemo, useState, useEffect } from "react";
import { format, addDays, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  CalendarPlus, UserPlus, RotateCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ReservationDetailDialog } from "@/components/ReservationDetailDialog";
import { ReservationDetailSheet } from "@/components/reservations/ReservationDetailSheet";
import { ReservationCard, type CardReservation } from "@/components/reservations/ReservationCard";
import { ReservationFormSheet } from "@/components/reservations/ReservationFormSheet";
import { WalkInDialog } from "@/components/WalkInDialog";
import { ReservationViewSwitcher, type ReservationView } from "@/components/reservations/ReservationViewSwitcher";
import { ReservationKpiStrip } from "@/components/reservations/ReservationKpiStrip";
import {
  ReservationFilterBar, DEFAULT_FILTERS, timeBandRange,
  type FilterState,
} from "@/components/reservations/ReservationFilterBar";
import { DayView } from "@/components/reservations/views/DayView";
import { WeekView } from "@/components/reservations/views/WeekView";
import { TableGridView } from "@/components/reservations/views/TableGridView";
import { QuickActionsMenu } from "@/components/reservations/QuickActionsMenu";
import { cn } from "@/lib/utils";

type DayReservation = CardReservation & {
  reservation_date: string;
  guest_id?: string | null;
  no_show_risk?: string | null;
  reconfirmation_status?: string | null;
};

const ReservationsPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;

  // URL-state
  const [params, setParams] = useSearchParams();
  const view = (params.get("view") as ReservationView) ?? "list";
  const dateStr = params.get("date") ?? format(new Date(), "yyyy-MM-dd");
  const date = useMemo(() => new Date(`${dateStr}T00:00:00`), [dateStr]);

  const setView = (v: ReservationView) => {
    if (v === "floor") {
      window.location.assign("/app/floor");
      return;
    }
    const next = new URLSearchParams(params);
    next.set("view", v);
    setParams(next, { replace: true });
  };
  const setDate = (d: Date) => {
    const next = new URLSearchParams(params);
    next.set("date", format(d, "yyyy-MM-dd"));
    setParams(next, { replace: true });
  };

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [kpiActive, setKpiActive] = useState<"attention" | "risk" | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);

  // Restaurant config
  const { data: restaurant } = useQuery({
    queryKey: ["restaurant-config", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants")
        .select("large_group_threshold")
        .eq("id", restaurantId!).maybeSingle();
      return data;
    },
  });
  const largeGroupThreshold = restaurant?.large_group_threshold ?? 9;

  // Day reservations
  const { data: reservations = [], isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["reservations-day", restaurantId, dateStr],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("reservations")
        .select(`
          id, reservation_date, start_time, end_time, party_size, status, channel,
          special_requests, internal_notes, occasion, dietary_notes, confirmation_code,
          requires_manual_approval, large_group_status, reminder_confirmed_at,
          guest_id, no_show_risk, reconfirmation_status,
          guests(first_name, last_name, phone, email, is_vip, allergies),
          reservation_tables(table_id, tables(label)),
          pre_orders(id)
        `)
        .eq("restaurant_id", restaurantId!).eq("reservation_date", dateStr)
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as unknown as DayReservation[];
    },
  });

  // Tables for "free now" KPI
  const { data: allTables = [] } = useQuery({
    queryKey: ["all-tables-count", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("tables")
        .select("id").eq("restaurant_id", restaurantId!).eq("is_active", true);
      return data ?? [];
    },
  });

  // Filtering
  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      // KPI shortcut filters
      if (kpiActive === "attention") {
        const needs = r.requires_manual_approval
          || r.status === "pending"
          || r.reconfirmation_status === "requested"
          || (r.large_group_status === "awaiting_approval");
        if (!needs) return false;
      }
      if (kpiActive === "risk" && !["medium", "high"].includes(r.no_show_risk ?? "")) return false;

      // status
      if (filters.status !== "all") {
        const norm = r.status === "finished" ? "completed" : r.status;
        if (norm !== filters.status) return false;
      }
      // signal
      if (filters.signal === "walk_in" && r.channel !== "walk_in") return false;
      if (filters.signal === "large_group" && r.party_size < largeGroupThreshold) return false;
      if (filters.signal === "allergy" && !r.guests?.allergies && !r.dietary_notes) return false;
      if (filters.signal === "preorder" && (r.pre_orders?.length ?? 0) === 0) return false;
      if (filters.signal === "approval" && !r.requires_manual_approval) return false;

      // time band
      const range = timeBandRange(filters.timeBand);
      if (range) {
        const h = new Date(r.start_time).getHours();
        if (h < range[0] || h >= range[1]) return false;
      }

      // channels (multi)
      if (filters.channels.length > 0 && !filters.channels.includes(r.channel)) return false;

      // party size
      if (r.party_size < filters.partySize[0] || r.party_size > filters.partySize[1]) return false;

      // risk
      if (filters.risk !== "all" && r.no_show_risk !== filters.risk) return false;

      // search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const name = `${r.guests?.first_name ?? ""} ${r.guests?.last_name ?? ""}`.toLowerCase();
        const email = (r.guests?.email ?? "").toLowerCase();
        const phone = (r.guests?.phone ?? "").toLowerCase();
        const code = (r.confirmation_code ?? "").toLowerCase();
        const note = `${r.special_requests ?? ""} ${r.internal_notes ?? ""}`.toLowerCase();
        const tables = (r.reservation_tables ?? []).map((rt) => rt?.tables?.label ?? "").join(" ").toLowerCase();
        if (![name, email, phone, code, note, tables].some((s) => s.includes(q))) return false;
      }
      return true;
    });
  }, [reservations, filters, kpiActive, largeGroupThreshold]);

  // Counts for signal chips
  const signalCounts = useMemo(() => ({
    walk_in:     reservations.filter((r) => r.channel === "walk_in").length,
    large_group: reservations.filter((r) => r.party_size >= largeGroupThreshold).length,
    allergy:     reservations.filter((r) => r.guests?.allergies || r.dietary_notes).length,
    preorder:    reservations.filter((r) => (r.pre_orders?.length ?? 0) > 0).length,
    approval:    reservations.filter((r) => r.requires_manual_approval).length,
  }), [reservations, largeGroupThreshold]);

  // KPIs
  const kpis = useMemo(() => {
    const guestsToday = reservations
      .filter((r) => !["cancelled", "no_show"].includes(r.status))
      .reduce((s, r) => s + r.party_size, 0);

    const needsAttention = reservations.filter((r) =>
      r.requires_manual_approval
      || r.status === "pending"
      || r.reconfirmation_status === "requested"
      || r.large_group_status === "awaiting_approval"
    ).length;

    const noShowRiskCount = reservations.filter((r) =>
      ["medium", "high"].includes(r.no_show_risk ?? "")
    ).length;

    // Free tables now: tables that have no active reservation overlapping current time
    const now = new Date();
    const isToday = format(now, "yyyy-MM-dd") === dateStr;
    let freeTablesNow = allTables.length;
    if (isToday && allTables.length > 0) {
      const occupiedTableIds = new Set<string>();
      for (const r of reservations) {
        if (["cancelled", "no_show", "completed", "finished"].includes(r.status)) continue;
        const start = new Date(r.start_time);
        const end = r.end_time ? new Date(r.end_time) : new Date(start.getTime() + 90 * 60 * 1000);
        if (now >= start && now <= end) {
          for (const rt of r.reservation_tables ?? []) {
            const tid = (rt as any)?.table_id;
            if (tid) occupiedTableIds.add(tid);
          }
        }
      }
      freeTablesNow = Math.max(0, allTables.length - occupiedTableIds.size);
    }

    return { guestsToday, needsAttention, freeTablesNow, noShowRiskCount };
  }, [reservations, allTables, dateStr]);

  const clearAll = () => { setFilters(DEFAULT_FILTERS); setKpiActive(null); };
  const filtersActive =
    filters.status !== "all" || filters.signal !== null || filters.search !== "" ||
    filters.timeBand !== "all" || filters.channels.length > 0 ||
    filters.risk !== "all" ||
    filters.partySize[0] !== 1 || filters.partySize[1] !== 20 ||
    kpiActive !== null;

  // Default to list view on small screens if nothing chosen
  useEffect(() => {
    if (!params.get("view") && window.innerWidth < 640) {
      setView("list");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderRowExtras = (r: DayReservation) => (
    <QuickActionsMenu
      reservation={r}
      restaurantId={restaurantId!}
      reservationDate={r.reservation_date ?? dateStr}
      guestId={r.guest_id}
      onEdit={(id) => setEditorId(id)}
    />
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Reserveringen</h1>
          <p className="text-muted-foreground capitalize text-sm">
            {format(date, "EEEE d MMMM yyyy", { locale: nl })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setDate(subDays(date, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-11">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, "d MMM yyyy", { locale: nl })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} locale={nl} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setDate(addDays(date, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" className="h-11" onClick={() => setWalkInOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Walk-in
          </Button>
          <Button className="h-11" onClick={() => setCreateOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" /> Reservering
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <ReservationKpiStrip
        guestsToday={kpis.guestsToday}
        needsAttention={kpis.needsAttention}
        freeTablesNow={kpis.freeTablesNow}
        noShowRiskCount={kpis.noShowRiskCount}
        activeKey={kpiActive}
        onSelect={setKpiActive}
      />

      {/* View switcher */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ReservationViewSwitcher value={view} onChange={setView} />
        {view === "list" || view === "day" ? (
          <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
            {dataUpdatedAt > 0 && <span>Bijgewerkt {format(new Date(dataUpdatedAt), "HH:mm")}</span>}
            <Button variant="ghost" size="sm" className="h-8" onClick={() => refetch()}>
              <RotateCw className="h-3 w-3 mr-1" /> Vernieuwen
            </Button>
          </div>
        ) : null}
      </div>

      {/* Filters */}
      {(view === "list" || view === "day") && (
        <ReservationFilterBar
          filters={filters}
          onChange={setFilters}
          counts={signalCounts}
          onClear={clearAll}
        />
      )}

      {/* Active view */}
      {view === "week" && restaurantId && (
        <WeekView
          date={date}
          restaurantId={restaurantId}
          onOpen={setSelectedId}
          onSelectDate={(d) => { setDate(d); setView("day"); }}
        />
      )}

      {view === "grid" && restaurantId && (
        <TableGridView date={date} restaurantId={restaurantId} onOpen={setSelectedId} />
      )}

      {view === "day" && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <ContentArea
              isError={isError}
              isLoading={isLoading}
              filtered={filtered}
              filtersActive={filtersActive}
              onClear={clearAll}
              onCreate={() => setCreateOpen(true)}
              onWalkIn={() => setWalkInOpen(true)}
              onRetry={() => refetch()}
              renderItems={() => (
                <DayView
                  date={date}
                  reservations={filtered}
                  onOpen={setSelectedId}
                  largeGroupThreshold={largeGroupThreshold}
                />
              )}
            />
          </CardContent>
        </Card>
      )}

      {view === "list" && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">
                {isLoading ? "Laden…" : `${filtered.length} ${filtered.length === 1 ? "reservering" : "reserveringen"}`}
              </div>
            </div>
            <ContentArea
              isError={isError}
              isLoading={isLoading}
              filtered={filtered}
              filtersActive={filtersActive}
              onClear={clearAll}
              onCreate={() => setCreateOpen(true)}
              onWalkIn={() => setWalkInOpen(true)}
              onRetry={() => refetch()}
              renderItems={() => (
                <div className="space-y-2">
                  {filtered.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      onOpen={setSelectedId}
                      largeGroupThreshold={largeGroupThreshold}
                      invalidateKeys={["reservations-day", "reservations-week"]}
                      extraActions={renderRowExtras(r)}
                    />
                  ))}
                </div>
              )}
            />
          </CardContent>
        </Card>
      )}

      <ReservationDetailSheet
        reservationId={selectedId}
        open={!!selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
        onOpenFullEditor={(id) => setEditorId(id)}
      />
      <ReservationDetailDialog
        reservationId={editorId}
        open={!!editorId}
        onOpenChange={(o) => !o && setEditorId(null)}
      />
      <ReservationFormSheet open={createOpen} onOpenChange={setCreateOpen} />
      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} />
    </div>
  );
};

function ContentArea({
  isError, isLoading, filtered, filtersActive,
  onClear, onCreate, onWalkIn, onRetry, renderItems,
}: {
  isError: boolean;
  isLoading: boolean;
  filtered: any[];
  filtersActive: boolean;
  onClear: () => void;
  onCreate: () => void;
  onWalkIn: () => void;
  onRetry: () => void;
  renderItems: () => React.ReactNode;
}) {
  if (isError) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-destructive">De reserveringen konden niet worden geladen.</p>
        <Button variant="outline" onClick={onRetry}>Opnieuw proberen</Button>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }
  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        {filtersActive ? (
          <>
            <p className="text-muted-foreground">Geen reserveringen gevonden met deze filters.</p>
            <Button variant="outline" onClick={onClear}>Filters wissen</Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">Geen reserveringen voor deze dag.</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={onWalkIn}>
                <UserPlus className="mr-2 h-4 w-4" /> Walk-in
              </Button>
              <Button onClick={onCreate}>
                <CalendarPlus className="mr-2 h-4 w-4" /> Reservering
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }
  return <>{renderItems()}</>;
}

export default ReservationsPage;
