import { useMemo, useState } from "react";
import { format, addDays, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ReservationDetailDialog } from "@/components/ReservationDetailDialog";
import { PacingIndicator, pacingLevelFromCovers } from "@/components/reservations/PacingIndicator";
import { cn } from "@/lib/utils";

// time grid 11:00 → 23:30 every 30 min
const START_HOUR = 11;
const END_HOUR = 24;
const SLOT_MIN = 30;
const PX_PER_MIN = 2; // 60 px per uur

const STATUS_BG: Record<string, string> = {
  pending: "bg-status-pending/30 border-status-pending/60",
  confirmed: "bg-status-confirmed/30 border-status-confirmed/60",
  seated: "bg-status-seated/30 border-status-seated/60",
  finished: "bg-status-completed/30 border-status-completed/60",
  cancelled: "bg-status-cancelled/20 border-status-cancelled/40 line-through opacity-60",
  no_show: "bg-status-noshow/20 border-status-noshow/40",
  hold: "bg-muted border-border",
};

const AgendaPage = () => {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;
  const [date, setDate] = useState<Date>(new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: tables = [] } = useQuery({
    queryKey: ["agenda-tables", rid],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("tables")
        .select("id, label, zone_id, zones(name)")
        .eq("restaurant_id", rid!).eq("is_active", true).order("label");
      return data ?? [];
    },
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ["agenda-day", rid, dateStr],
    enabled: !!rid,
    queryFn: async () => {
      const { data } = await supabase.from("reservations")
        .select("id, start_time, end_time, status, party_size, guests(first_name, last_name), reservation_tables(table_id)")
        .eq("restaurant_id", rid!).eq("reservation_date", dateStr);
      return data ?? [];
    },
  });

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
  const totalWidth = totalMinutes * PX_PER_MIN;

  // group reservations by table_id
  const byTable = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of reservations as any[]) {
      const tids = r.reservation_tables?.map((rt: any) => rt.table_id) ?? [];
      for (const tid of tids) {
        (map[tid] ||= []).push(r);
      }
    }
    return map;
  }, [reservations]);

  const dayStart = new Date(date);
  dayStart.setHours(START_HOUR, 0, 0, 0);

  const minutesFromStart = (iso: string) => {
    const d = new Date(iso);
    return (d.getHours() - START_HOUR) * 60 + d.getMinutes();
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Agenda</h1>
          <p className="text-muted-foreground capitalize">{format(date, "EEEE d MMMM yyyy", { locale: nl })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate(subDays(date, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "d MMM yyyy", { locale: nl })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} locale={nl} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {tables.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Configureer eerst tafels in instellingen.</div>
          ) : (
            <div className="relative" style={{ minWidth: totalWidth + 120 }}>
              {/* Header row */}
              <div className="sticky top-0 z-10 bg-card border-b border-border flex">
                <div className="w-[120px] shrink-0 p-2 text-xs font-medium text-muted-foreground border-r border-border">Tafel</div>
                <div className="relative flex-1" style={{ width: totalWidth }}>
                  {slots.map((s, i) => (
                    <div
                      key={s}
                      className={cn("absolute top-0 h-full text-[10px] text-muted-foreground border-l border-border/50", i % 2 === 0 ? "" : "border-l-dashed")}
                      style={{ left: i * SLOT_MIN * PX_PER_MIN, width: SLOT_MIN * PX_PER_MIN }}
                    >
                      {i % 2 === 0 && <span className="px-1">{s}</span>}
                    </div>
                  ))}
                  <div className="h-6" />
                </div>
              </div>

              {/* Rows */}
              {(tables as any[]).map((t) => {
                const items = byTable[t.id] ?? [];
                return (
                  <div key={t.id} className="flex border-b border-border hover:bg-muted/20">
                    <div className="w-[120px] shrink-0 p-3 border-r border-border">
                      <div className="font-medium text-sm">{t.label}</div>
                      {t.zones?.name && <div className="text-xs text-muted-foreground">{t.zones.name}</div>}
                    </div>
                    <div className="relative" style={{ width: totalWidth, height: 56 }}>
                      {/* slot grid lines */}
                      {slots.map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 h-full border-l border-border/30"
                          style={{ left: i * SLOT_MIN * PX_PER_MIN }}
                        />
                      ))}
                      {/* reservations */}
                      {items.map((r) => {
                        const startMin = minutesFromStart(r.start_time);
                        const endMin = minutesFromStart(r.end_time);
                        const left = Math.max(0, startMin) * PX_PER_MIN;
                        const width = Math.max(20, (endMin - startMin) * PX_PER_MIN - 2);
                        return (
                          <button
                            key={r.id}
                            onClick={() => setSelectedId(r.id)}
                            className={cn(
                              "absolute top-2 bottom-2 rounded-md border px-2 text-left text-xs overflow-hidden hover:brightness-110 transition-all",
                              STATUS_BG[r.status] ?? "bg-muted border-border"
                            )}
                            style={{ left, width }}
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
          )}
        </CardContent>
      </Card>

      <ReservationDetailDialog reservationId={selectedId} open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </div>
  );
};

export default AgendaPage;
