// Tafelgrid: tafels × tijdslots, hergebruikt als embedded view binnen
// /app/reserveringen. Houdt /app/agenda volledig intact.
import { useMemo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const START_HOUR = 11;
const END_HOUR = 24;
const SLOT_MIN = 30;
const PX_PER_MIN = 2;

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

export function TableGridView({
  date,
  restaurantId,
  onOpen,
}: {
  date: Date;
  restaurantId: string;
  onOpen: (id: string) => void;
}) {
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: tables = [] } = useQuery({
    queryKey: ["agenda-tables", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("tables")
        .select("id, label, zone_id, zones(name)")
        .eq("restaurant_id", restaurantId).eq("is_active", true).order("label");
      return data ?? [];
    },
  });

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

  if (tables.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          Configureer eerst tafels in instellingen om het tafelgrid te zien.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <div className="relative" style={{ minWidth: totalWidth + 120 }}>
          <div className="sticky top-0 z-10 bg-card border-b border-border flex">
            <div className="w-[120px] shrink-0 p-2 text-xs font-medium text-muted-foreground border-r border-border">Tafel</div>
            <div className="relative flex-1" style={{ width: totalWidth }}>
              {slots.map((s, i) => (
                <div
                  key={s}
                  className="absolute top-0 h-full text-[10px] text-muted-foreground border-l border-border/50"
                  style={{ left: i * SLOT_MIN * PX_PER_MIN, width: SLOT_MIN * PX_PER_MIN }}
                >
                  {i % 2 === 0 && <span className="px-1">{s}</span>}
                </div>
              ))}
              <div className="h-6" />
            </div>
          </div>

          {(tables as any[]).map((t) => {
            const items = byTable[t.id] ?? [];
            return (
              <div key={t.id} className="flex border-b border-border hover:bg-muted/20">
                <div className="w-[120px] shrink-0 p-3 border-r border-border">
                  <div className="font-medium text-sm">{t.label}</div>
                  {t.zones?.name && <div className="text-xs text-muted-foreground">{t.zones.name}</div>}
                </div>
                <div className="relative" style={{ width: totalWidth, height: 56 }}>
                  {slots.map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-full border-l border-border/30"
                      style={{ left: i * SLOT_MIN * PX_PER_MIN }}
                    />
                  ))}
                  {items.map((r) => {
                    const startMin = minutesFromStart(r.start_time);
                    const endMin = minutesFromStart(r.end_time);
                    const left = Math.max(0, startMin) * PX_PER_MIN;
                    const width = Math.max(20, (endMin - startMin) * PX_PER_MIN - 2);
                    return (
                      <button
                        key={r.id}
                        onClick={() => onOpen(r.id)}
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
      </CardContent>
    </Card>
  );
}
