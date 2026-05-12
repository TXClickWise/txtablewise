// Tafelgrid: tafels × tijdslots, hergebruikt als embedded view binnen
// /app/reserveringen. Houdt /app/agenda volledig intact.
import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Minus, Plus, MoveHorizontal, MoveVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const START_HOUR = 11;
const END_HOUR = 24;
const SLOT_MIN = 30;
const QUARTER_MIN = 15;

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

export type CreatePrefill = {
  tableId: string;
  tableLabel: string;
  startTime: string; // HH:mm
};

export function TableGridView({
  date,
  restaurantId,
  onOpen,
  onCreate,
}: {
  date: Date;
  restaurantId: string;
  onOpen: (id: string) => void;
  onCreate?: (p: CreatePrefill) => void;
}) {
  const dateStr = format(date, "yyyy-MM-dd");
  const [pxPerMin, setPxPerMin] = useState(2);
  const [rowHeight, setRowHeight] = useState(56);

  const { data: tables = [] } = useQuery({
    queryKey: ["agenda-tables", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("tables")
        .select("id, label, capacity_min, capacity_max, zone_id, zones(name)")
        .eq("restaurant_id", restaurantId).eq("is_active", true).order("label");
      return data ?? [];
    },
  });
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data: reservations = [] } = useQuery({
    queryKey: ["agenda-day", restaurantId, dateStr],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("reservations")
        .select("id, start_time, end_time, status, party_size, guests(first_name, last_name), reservation_tables(table_id)")
        .eq("restaurant_id", restaurantId).eq("reservation_date", dateStr);
      return data ?? [];
    },
  });

  const { data: restaurantConfig } = useQuery({
    queryKey: ["agenda-restaurant-cfg", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants")
        .select("default_reservation_minutes")
        .eq("id", restaurantId).maybeSingle();
      return data;
    },
  });
  const defaultDuration = restaurantConfig?.default_reservation_minutes ?? 90;

  const slots = useMemo(() => {
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

  const handleQuarterClick = (table: any, quarterIndex: number) => {
    if (!onCreate) return;
    const items = (byTable[table.id] ?? []) as any[];
    const clickMin = quarterIndex * QUARTER_MIN;

    // Bepaal of we vóór, ná of binnen een bestaande reservering klikken.
    let chosenMin = clickMin;
    const sorted = [...items].sort(
      (a, b) => minutesFromStart(a.start_time) - minutesFromStart(b.start_time)
    );
    for (const r of sorted) {
      const sMin = minutesFromStart(r.start_time);
      const eMin = minutesFromStart(r.end_time);
      if (clickMin >= sMin && clickMin < eMin) {
        // Klik op blok zelf - opent reservering
        onOpen(r.id);
        return;
      }
    }
    // Vind volgende reservering ná klik-tijd
    const next = sorted.find((r) => minutesFromStart(r.start_time) > clickMin);
    if (next) {
      const nextStart = minutesFromStart(next.start_time);
      if (clickMin + defaultDuration > nextStart) {
        chosenMin = Math.max(0, nextStart - defaultDuration);
      }
    }
    // Klamp op 'nu' als datum vandaag is
    const today = new Date();
    if (format(today, "yyyy-MM-dd") === dateStr) {
      const nowMin = (today.getHours() - START_HOUR) * 60 + today.getMinutes();
      const nextQuarter = Math.ceil(nowMin / QUARTER_MIN) * QUARTER_MIN;
      if (chosenMin < nextQuarter) chosenMin = nextQuarter;
    }
    if (chosenMin < 0) chosenMin = 0;
    if (chosenMin >= totalMinutes) return;

    onCreate({
      tableId: table.id,
      tableLabel: table.label,
      startTime: minutesToTime(chosenMin),
    });
  };

  if (tables.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          Configureer eerst tafels in instellingen om het tafelgrid te zien.
        </CardContent>
      </Card>
    );
  }

  // Group tables per zone for quick-jump buttons
  const zoneGroups = useMemo(() => {
    const map = new Map<string, { name: string; firstTableId: string }>();
    for (const t of tables as any[]) {
      const key = t.zone_id ?? "_none";
      if (!map.has(key)) {
        map.set(key, { name: t.zones?.name ?? "Overig", firstTableId: t.id });
      }
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [tables]);

  const jumpToZone = (tableId: string) => {
    const el = rowRefs.current[tableId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Card>
      {zoneGroups.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border overflow-x-auto">
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
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-xs">
        <div className="flex items-center gap-1">
          <MoveHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPxPerMin((v) => Math.max(1, v - 0.5))}><Minus className="h-3 w-3" /></Button>
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPxPerMin((v) => Math.min(6, v + 0.5))}><Plus className="h-3 w-3" /></Button>
        </div>
        <div className="flex items-center gap-1">
          <MoveVertical className="h-3.5 w-3.5 text-muted-foreground" />
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setRowHeight((v) => Math.max(40, v - 8))}><Minus className="h-3 w-3" /></Button>
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setRowHeight((v) => Math.min(120, v + 8))}><Plus className="h-3 w-3" /></Button>
        </div>
        <span className="text-muted-foreground ml-auto">Tip: tik op een leeg tijdvak om een reservering toe te voegen.</span>
      </div>
      <CardContent className="p-0 overflow-x-auto">
        <div className="relative" style={{ minWidth: totalWidth + 120 }}>
          <div className="sticky top-0 z-30 bg-card border-b border-border flex">
            <div className="sticky left-0 z-40 bg-card w-[120px] shrink-0 p-2 text-xs font-medium text-muted-foreground border-r border-border">Tafel</div>
            <div className="relative flex-1" style={{ width: totalWidth }}>
              {slots.map((s, i) => (
                <div
                  key={s}
                  className="absolute top-0 h-full text-[10px] text-muted-foreground border-l border-border/50"
                  style={{ left: i * SLOT_MIN * pxPerMin, width: SLOT_MIN * pxPerMin }}
                >
                  {i % 2 === 0 && <span className="px-1">{s}</span>}
                </div>
              ))}
              <div className="h-6" />
            </div>
          </div>

          {(tables as any[]).map((t) => {
            const items = byTable[t.id] ?? [];
            const cap = t.capacity_min === t.capacity_max
              ? `${t.capacity_max}p`
              : `${t.capacity_min}–${t.capacity_max}p`;
            return (
              <div
                key={t.id}
                ref={(el) => { rowRefs.current[t.id] = el; }}
                className="flex border-b border-border hover:bg-muted/10 scroll-mt-16"
              >
                <div className="sticky left-0 z-20 bg-card w-[120px] shrink-0 p-3 border-r border-border">
                  <div className="flex items-baseline justify-between gap-1">
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">{cap}</div>
                  </div>
                  {t.zones?.name && <div className="text-xs text-muted-foreground">{t.zones.name}</div>}
                </div>
                <div className="relative" style={{ width: totalWidth, height: rowHeight }}>
                  {/* Klikbare kwartier-cellen (achter de blokken) */}
                  {Array.from({ length: quarterCount }).map((_, i) => (
                    <button
                      key={`q-${i}`}
                      type="button"
                      onClick={() => handleQuarterClick(t, i)}
                      className={cn(
                        "absolute top-0 h-full border-l transition-colors",
                        i % 4 === 0
                          ? "border-border/60"
                          : i % 2 === 0
                          ? "border-border/30"
                          : "border-border/15",
                        "hover:bg-primary/5 active:bg-primary/10"
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
                        onClick={(e) => { e.stopPropagation(); onOpen(r.id); }}
                        className={cn(
                          "absolute rounded-md border px-2 text-left text-xs overflow-hidden hover:brightness-110 transition-all z-10",
                          STATUS_BG[r.status] ?? "bg-muted border-border"
                        )}
                        style={{ left, width, top: 6, height: rowHeight - 12 }}
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
        </div>
      </CardContent>
    </Card>
  );
}
