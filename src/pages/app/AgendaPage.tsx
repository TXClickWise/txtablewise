// AgendaPage — tablet-first dag-agenda met sticky kop en scrollend grid.
// Layout:
//   ┌ rij 1: [Tijdlijn|Lijst] · Spring naar · toolbar (zoom/nav/datum)
//   │ rij 2: tip
//   │ rij 3: uren-as (Tafel | 11:00 12:00 …) — horizontaal gesynced met body
//   ├──── (alles hierboven sticky bovenin <main>) ────
//   └ body: tafelrijen, scrollt horizontaal en (samen met main) verticaal
import { useEffect, useMemo, useRef, useState } from "react";
import { format, addDays, subDays, isSameDay, parseISO, isValid } from "date-fns";
import { nl } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  ZoomIn, ZoomOut, MoveVertical, Maximize2, Minimize2,
  CalendarDays, List, LayoutGrid,
} from "lucide-react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ReservationDetailDialog } from "@/components/ReservationDetailDialog";
import { ReservationFormSheet, type ReservationFormPrefill } from "@/components/reservations/ReservationFormSheet";
import { WalkInDialog } from "@/components/WalkInDialog";
import { DayView } from "@/components/reservations/views/DayView";
import { EmptyState } from "@/components/touch/StateViews";
import { cn } from "@/lib/utils";

const START_HOUR = 11;
const END_HOUR = 24;
const SLOT_MIN = 30;
const QUARTER_MIN = 15;
const PX_MIN = 1;
const PX_MAX = 6;
const PX_STEP = 0.5;
const PX_DEFAULT = 2;
const ROW_MIN = 48;
const ROW_MAX = 120;
const ROW_STEP = 8;
const ROW_DEFAULT = 64;
const TAFEL_COL_W = 120;

const STATUS_BG: Record<string, string> = {
  pending: "bg-status-pending/30 border-status-pending/60",
  confirmed: "bg-status-confirmed/30 border-status-confirmed/60",
  seated: "bg-status-seated/30 border-status-seated/60",
  finished: "bg-status-completed/30 border-status-completed/60",
  completed: "bg-status-completed/30 border-status-completed/60",
  cancelled: "bg-status-cancelled/20 border-status-cancelled/40 line-through opacity-60",
  no_show: "bg-status-noshow/20 border-status-noshow/40",
  hold: "bg-muted border-border",
};

type ViewMode = "tijdlijn" | "lijst" | "plattegrond";

const AgendaPage = () => {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;
  const [searchParams, setSearchParams] = useSearchParams();

  const initialDate = (() => {
    const p = searchParams.get("date");
    if (p) {
      const d = parseISO(p);
      if (isValid(d)) return d;
    }
    return new Date();
  })();
  const [date, setDateState] = useState<Date>(initialDate);
  const setDate = (d: Date) => {
    setDateState(d);
    const next = new URLSearchParams(searchParams);
    if (isSameDay(d, new Date())) next.delete("date");
    else next.set("date", format(d, "yyyy-MM-dd"));
    setSearchParams(next, { replace: true });
  };

  const tabParam = searchParams.get("tab");
  const view: ViewMode =
    tabParam === "lijst" ? "lijst" : tabParam === "plattegrond" ? "plattegrond" : "tijdlijn";
  const setView = (v: ViewMode) => {
    const next = new URLSearchParams(searchParams);
    if (v === "tijdlijn") next.delete("tab");
    else next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pxPerMin, setPxPerMin] = useState(PX_DEFAULT);
  const [rowHeight, setRowHeight] = useState(ROW_DEFAULT);
  const [now, setNow] = useState(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<ReservationFormPrefill | undefined>(undefined);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInTable, setWalkInTable] = useState<{ id: string; label: string } | undefined>(undefined);
  const [fullscreen, setFullscreen] = useState(false);
  const [floorZoneId, setFloorZoneId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const headerAxisRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const dateStr = format(date, "yyyy-MM-dd");

  // tick "nu" elke 15 min — synchroon met kwartier
  useEffect(() => {
    const tick = () => setNow(new Date());
    const n = new Date();
    const msToNextQuarter =
      ((15 - (n.getMinutes() % 15)) * 60 - n.getSeconds()) * 1000 - n.getMilliseconds();
    let intervalId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 15 * 60_000);
    }, Math.max(1000, msToNextQuarter));
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  const inactivityTimer = useRef<number | null>(null);
  const recenterToNow = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    const n = new Date();
    const totalMin = n.getHours() * 60 + n.getMinutes();
    const snapped = Math.round(totalMin / 15) * 15;
    const m = snapped - START_HOUR * 60;
    if (m < 0 || m > (END_HOUR - START_HOUR) * 60) return;
    const target = Math.max(0, m * pxPerMin - el.clientWidth / 3);
    el.scrollTo({ left: target, behavior: smooth ? "smooth" : "auto" });
  };
  const resetInactivity = () => {
    if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
    if (!isSameDay(date, new Date())) return;
    inactivityTimer.current = window.setTimeout(() => recenterToNow(true), 2 * 60_000);
  };
  useEffect(() => {
    resetInactivity();
    return () => {
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, pxPerMin]);

  const { data: tables = [] } = useQuery({
    queryKey: ["agenda-tables", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("tables")
        .select("id, label, capacity_min, capacity_max, zone_id, pos_x, pos_y, width, height, shape, zones(name)")
        .eq("restaurant_id", rid!).eq("is_active", true).order("label");
      return data ?? [];
    },
  });
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const zoneGroups = useMemo(() => {
    const map = new Map<string, { name: string; firstTableId: string }>();
    for (const t of tables as any[]) {
      const key = t.zone_id ?? "_none";
      if (!map.has(key)) map.set(key, { name: t.zones?.name ?? "Overig", firstTableId: t.id });
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [tables]);

  useEffect(() => {
    if (!floorZoneId && zoneGroups.length > 0) setFloorZoneId(zoneGroups[0].key);
  }, [zoneGroups, floorZoneId]);

  const jumpToZone = (tableId: string) => {
    const el = rowRefs.current[tableId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const { data: reservations = [] } = useQuery({
    queryKey: ["agenda-day", rid, dateStr],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("reservations")
        .select("id, start_time, end_time, status, party_size, channel, guests(first_name, last_name, is_vip), reservation_tables(table_id)")
        .eq("restaurant_id", rid!).eq("reservation_date", dateStr);
      return data ?? [];
    },
  });

  const { data: restaurantConfig } = useQuery({
    queryKey: ["agenda-restaurant-cfg", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants")
        .select("default_reservation_minutes, large_group_threshold")
        .eq("id", rid!).maybeSingle();
      return data;
    },
  });
  const defaultDuration = restaurantConfig?.default_reservation_minutes ?? 90;
  const largeGroupThreshold = restaurantConfig?.large_group_threshold ?? undefined;

  const slotLabels = useMemo(() => {
    const out: string[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      for (let m = 0; m < 60; m += SLOT_MIN) {
        out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return out;
  }, []);

  const totalMinutes = (END_HOUR - START_HOUR) * 60;
  const totalWidth = totalMinutes * pxPerMin;
  const quarterCount = totalMinutes / QUARTER_MIN;

  const byTable = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of reservations as any[]) {
      const tids = r.reservation_tables?.map((rt: any) => rt.table_id) ?? [];
      for (const tid of tids) (map[tid] ||= []).push(r);
    }
    return map;
  }, [reservations]);

  const minutesFromStart = (iso: string) => {
    const d = new Date(iso);
    return (d.getHours() - START_HOUR) * 60 + d.getMinutes();
  };
  const minutesToTime = (mins: number) => {
    const total = START_HOUR * 60 + mins;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const isToday = isSameDay(date, now);
  const nowMin = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
  const showNowLine = isToday && nowMin >= 0 && nowMin <= totalMinutes;

  // Initieel scrollen naar nu (op vandaag)
  useEffect(() => {
    if (view !== "tijdlijn") return;
    if (!scrollRef.current || tables.length === 0) return;
    const el = scrollRef.current;
    if (isToday) {
      const target = Math.max(0, nowMin * pxPerMin - el.clientWidth / 3);
      el.scrollTo({ left: target, behavior: didInitialScroll.current ? "smooth" : "auto" });
    } else if (!didInitialScroll.current) {
      el.scrollTo({ left: 0 });
    }
    didInitialScroll.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, tables.length, view]);

  const zoomBy = (delta: number) => {
    const el = scrollRef.current;
    const oldPx = pxPerMin;
    const next = Math.max(PX_MIN, Math.min(PX_MAX, +(oldPx + delta).toFixed(2)));
    if (next === oldPx) return;
    let centerMin = nowMin;
    if (el) centerMin = (el.scrollLeft + el.clientWidth / 2) / oldPx;
    setPxPerMin(next);
    requestAnimationFrame(() => {
      const e2 = scrollRef.current;
      if (!e2) return;
      e2.scrollLeft = Math.max(0, centerMin * next - e2.clientWidth / 2);
      if (headerAxisRef.current) headerAxisRef.current.scrollLeft = e2.scrollLeft;
    });
  };
  const rowZoom = (delta: number) =>
    setRowHeight((v) => Math.max(ROW_MIN, Math.min(ROW_MAX, v + delta)));

  // Pinch-zoom op touch
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; px: number; centerMin: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const el = scrollRef.current;
      const centerMin = el ? (el.scrollLeft + el.clientWidth / 2) / pxPerMin : nowMin;
      pinchStart.current = { dist, px: pxPerMin, centerMin };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / pinchStart.current.dist;
      const next = Math.max(PX_MIN, Math.min(PX_MAX, pinchStart.current.px * ratio));
      if (Math.abs(next - pxPerMin) > 0.05) {
        setPxPerMin(+next.toFixed(2));
        requestAnimationFrame(() => {
          const el = scrollRef.current;
          if (!el || !pinchStart.current) return;
          el.scrollLeft = Math.max(0, pinchStart.current.centerMin * next - el.clientWidth / 2);
          if (headerAxisRef.current) headerAxisRef.current.scrollLeft = el.scrollLeft;
        });
      }
    }
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  };

  const zoomPct = Math.round((pxPerMin / PX_DEFAULT) * 100);

  const handleQuarterClick = (table: any, quarterIndex: number) => {
    const items = (byTable[table.id] ?? []) as any[];
    const clickMin = quarterIndex * QUARTER_MIN;
    const sorted = [...items].sort(
      (a, b) => minutesFromStart(a.start_time) - minutesFromStart(b.start_time),
    );
    for (const r of sorted) {
      const sMin = minutesFromStart(r.start_time);
      const eMin = minutesFromStart(r.end_time);
      if (clickMin >= sMin && clickMin < eMin) {
        setSelectedId(r.id);
        return;
      }
    }
    let chosenMin = clickMin;
    const next = sorted.find((r) => minutesFromStart(r.start_time) > clickMin);
    if (next) {
      const nextStart = minutesFromStart(next.start_time);
      if (clickMin + defaultDuration > nextStart) {
        chosenMin = Math.max(0, nextStart - defaultDuration);
      }
    }
    const today = new Date();
    if (format(today, "yyyy-MM-dd") === dateStr) {
      const nowM = (today.getHours() - START_HOUR) * 60 + today.getMinutes();
      const nextQ = Math.ceil(nowM / QUARTER_MIN) * QUARTER_MIN;
      if (chosenMin < nextQ) chosenMin = nextQ;
    }
    if (chosenMin < 0) chosenMin = 0;
    if (chosenMin >= totalMinutes) return;
    setCreatePrefill({
      date: dateStr,
      time: minutesToTime(chosenMin),
      tableId: table.id,
      tableLabel: table.label,
    });
    setCreateOpen(true);
  };

  // Sync horizontal scroll: body → header axis
  const handleBodyScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (headerAxisRef.current && headerAxisRef.current.scrollLeft !== el.scrollLeft) {
      headerAxisRef.current.scrollLeft = el.scrollLeft;
    }
    resetInactivity();
  };

  // ESC sluit fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Header rendering ----------------------------------------------------------
  const ViewSwitcher = (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5">
      {([
        { v: "tijdlijn" as const, icon: CalendarDays, label: "Tijdlijn" },
        { v: "lijst" as const, icon: List, label: "Lijst" },
        { v: "plattegrond" as const, icon: LayoutGrid, label: "Plattegrond" },
      ]).map((it) => {
        const active = view === it.v;
        return (
          <button
            key={it.v}
            type="button"
            onClick={() => setView(it.v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 h-8 rounded text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
          >
            <it.icon className="h-4 w-4" />
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );

  const Toolbar = (
    <div className="flex items-center gap-1 flex-wrap">
      {view === "tijdlijn" && (
        <>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => zoomBy(-PX_STEP)} disabled={pxPerMin <= PX_MIN} aria-label="Uitzoomen">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">{zoomPct}%</span>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => zoomBy(PX_STEP)} disabled={pxPerMin >= PX_MAX} aria-label="Inzoomen">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setFullscreen((v) => !v)} aria-label={fullscreen ? "Verlaat volledig scherm" : "Volledig scherm"}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => rowZoom(rowHeight >= ROW_MAX ? -ROW_STEP : ROW_STEP)} aria-label="Rijhoogte wisselen">
            <MoveVertical className="h-4 w-4" />
          </Button>
        </>
      )}
      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setDate(subDays(date, 1))} aria-label="Vorige dag">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(date, "d MMM yyyy", { locale: nl })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} locale={nl} initialFocus className={cn("p-3 pointer-events-auto")} />
        </PopoverContent>
      </Popover>
      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setDate(addDays(date, 1))} aria-label="Volgende dag">
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isToday && (
        <Button variant="outline" className="h-9" onClick={() => setDate(new Date())}>
          Vandaag
        </Button>
      )}
    </div>
  );

  // Lijst-view rendering -----------------------------------------------------
  const listReservations = useMemo(() => {
    return (reservations as any[]).map((r) => ({
      id: r.id,
      start_time: r.start_time,
      party_size: r.party_size,
      status: r.status,
      channel: r.channel,
      guests: r.guests ?? null,
    }));
  }, [reservations]);

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-background flex flex-col"
    : "flex flex-col h-full min-h-0";

  return (
    <div className={containerClass}>
      {/* === STICKY KOP === */}
      <div className="sticky top-0 z-30 bg-card border-b border-border">
        {/* Rij 1: view-switcher · spring naar · toolbar */}
        <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
          {ViewSwitcher}

          {view === "tijdlijn" && zoneGroups.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto min-w-0">
              <span className="text-xs text-muted-foreground shrink-0">Spring naar:</span>
              {zoneGroups.map((z) => (
                <Button
                  key={z.key}
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => jumpToZone(z.firstTableId)}
                >
                  {z.name}
                </Button>
              ))}
            </div>
          )}

          <div className="ml-auto">{Toolbar}</div>
        </div>

        {view === "tijdlijn" && tables.length > 0 && (
          <>
            {/* Rij 2: tip */}
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border">
              Tip: tik op een leeg tijdvak om snel een reservering toe te voegen op die tafel.
            </div>

            {/* Rij 3: uren-as (horizontaal gesynced met body) */}
            <div
              ref={headerAxisRef}
              className="flex border-t border-border overflow-x-hidden"
            >
              <div
                className="bg-card shrink-0 p-2 text-xs font-medium text-muted-foreground border-r border-border"
                style={{ width: TAFEL_COL_W }}
              >
                Tafel
              </div>
              <div className="relative shrink-0" style={{ width: totalWidth, height: 24 }}>
                {slotLabels.map((s, i) => (
                  <div
                    key={s}
                    className="absolute top-0 h-full text-[10px] text-muted-foreground border-l border-border/50"
                    style={{ left: i * SLOT_MIN * pxPerMin, width: SLOT_MIN * pxPerMin }}
                  >
                    {i % 2 === 0 && <span className="px-1">{s}</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* === BODY === */}
      {view === "lijst" ? (
        <div className="flex-1 min-h-0 overflow-auto p-3">
          <DayView
            date={date}
            reservations={listReservations as any}
            onOpen={(id) => setSelectedId(id)}
            largeGroupThreshold={largeGroupThreshold}
          />
        </div>
      ) : tables.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={<CalendarIcon />}
            title="Nog geen tafels geconfigureerd"
            description="Voeg tafels en zones toe in de instellingen om de agenda te gebruiken."
          />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-auto"
          style={{ touchAction: "pan-x pan-y" }}
          onPointerDown={(e) => { resetInactivity(); onPointerDown(e); }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={onPointerEnd}
          onScroll={handleBodyScroll}
          onWheel={resetInactivity}
        >
          <div className="relative" style={{ minWidth: totalWidth + TAFEL_COL_W }}>
            {(tables as any[]).map((t) => {
              const items = byTable[t.id] ?? [];
              const cap = t.capacity_min === t.capacity_max
                ? `${t.capacity_max}p`
                : `${t.capacity_min}–${t.capacity_max}p`;
              return (
                <div
                  key={t.id}
                  ref={(el) => { rowRefs.current[t.id] = el; }}
                  className="flex border-b border-border hover:bg-muted/10 scroll-mt-2"
                >
                  <div
                    className="sticky left-0 z-[5] bg-card shrink-0 p-3 border-r border-border flex flex-col justify-center"
                    style={{ width: TAFEL_COL_W }}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <div className="font-medium text-sm">{t.label}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">{cap}</div>
                    </div>
                    {t.zones?.name && <div className="text-xs text-muted-foreground">{t.zones.name}</div>}
                  </div>
                  <div className="relative" style={{ width: totalWidth, height: rowHeight }}>
                    {Array.from({ length: quarterCount }).map((_, i) => (
                      <button
                        key={`q-${t.id}-${i}`}
                        type="button"
                        onClick={() => handleQuarterClick(t, i)}
                        className={cn(
                          "absolute top-0 h-full border-l transition-colors",
                          i % 4 === 0
                            ? "border-border/60"
                            : i % 2 === 0
                            ? "border-border/30"
                            : "border-border/15",
                          "hover:bg-primary/5 active:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none",
                        )}
                        style={{ left: i * QUARTER_MIN * pxPerMin, width: QUARTER_MIN * pxPerMin }}
                        aria-label={`Reservering toevoegen op ${t.label} om ${minutesToTime(i * QUARTER_MIN)}`}
                      />
                    ))}
                    {items.map((r) => {
                      const startMin = minutesFromStart(r.start_time);
                      const endMin = minutesFromStart(r.end_time);
                      const left = Math.max(0, startMin) * pxPerMin;
                      const width = Math.max(20, (endMin - startMin) * pxPerMin - 2);
                      return (
                        <button
                          key={r.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }}
                          className={cn(
                            "absolute rounded-md border px-2 text-left text-xs overflow-hidden hover:brightness-110 transition-all z-[2]",
                            STATUS_BG[r.status] ?? "bg-muted border-border",
                          )}
                          style={{ left, top: 6, height: rowHeight - 12, width }}
                        >
                          <div className="font-medium truncate">
                            {format(new Date(r.start_time), "HH:mm")} · {r.guests?.first_name ?? "Gast"} {r.guests?.last_name ?? ""}
                          </div>
                          <div className="text-[10px] opacity-80">{r.party_size}p</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {showNowLine && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-[3]"
                style={{ left: TAFEL_COL_W + nowMin * pxPerMin }}
                aria-hidden
              >
                <div className="absolute top-0 bottom-0 w-[2px] bg-primary" />
                <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-primary shadow" />
                <div className="absolute top-1 left-2 px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary text-primary-foreground tabular-nums whitespace-nowrap">
                  {format(now, "HH:mm")}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ReservationDetailDialog
        reservationId={selectedId}
        open={!!selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
      <ReservationFormSheet
        open={createOpen}
        onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreatePrefill(undefined); }}
        prefill={createPrefill}
      />
      <WalkInDialog
        open={walkInOpen}
        onOpenChange={(o) => { setWalkInOpen(o); if (!o) setWalkInTable(undefined); }}
        prefilledTable={walkInTable}
      />
    </div>
  );
};

export default AgendaPage;
