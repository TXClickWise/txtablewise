import { useMemo } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { nl } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { CardReservation } from "@/components/reservations/ReservationCard";

const STATUS_DOT: Record<string, string> = {
  pending: "bg-status-pending",
  confirmed: "bg-status-confirmed",
  seated: "bg-status-seated",
  completed: "bg-status-completed",
  finished: "bg-status-completed",
  cancelled: "bg-status-cancelled",
  no_show: "bg-status-noshow",
  hold: "bg-muted-foreground",
};

export function WeekView({
  date,
  restaurantId,
  onOpen,
  onSelectDate,
}: {
  date: Date;
  restaurantId: string;
  onOpen: (id: string) => void;
  onSelectDate: (d: Date) => void;
}) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const fromStr = format(weekStart, "yyyy-MM-dd");
  const toStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ["reservations-week", restaurantId, fromStr],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("reservations")
        .select(`
          id, reservation_date, start_time, party_size, status, channel,
          guest_first_name, guest_last_name,
          guests(first_name, last_name, is_vip)
        `)
        .eq("restaurant_id", restaurantId)
        .gte("reservation_date", fromStr)
        .lte("reservation_date", toStr)
        .neq("status", "cancelled")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as unknown as Array<CardReservation & { reservation_date: string }>;
    },
  });

  const byDay = useMemo(() => {
    const map: Record<string, typeof reservations> = {};
    for (const r of reservations) (map[r.reservation_date] ||= []).push(r);
    return map;
  }, [reservations]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const items = byDay[key] ?? [];
        const isToday = isSameDay(d, new Date());
        const isCurrent = isSameDay(d, date);
        return (
          <Card
            key={key}
            className={cn(
              "transition-colors cursor-pointer hover:border-primary/50",
              isCurrent && "border-primary ring-1 ring-primary/30",
            )}
            onClick={() => onSelectDate(d)}
          >
            <CardContent className="p-2.5 space-y-1.5 min-h-[160px]">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">
                    {format(d, "EEE", { locale: nl })}
                  </div>
                  <div className={cn("font-display text-xl leading-none", isToday && "text-primary")}>
                    {format(d, "d", { locale: nl })}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {items.reduce((s, r) => s + r.party_size, 0)}p
                </span>
              </div>
              {isLoading ? (
                <div className="h-12 rounded bg-muted/40 animate-pulse" />
              ) : items.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic">Geen reserveringen</div>
              ) : (
                <div className="space-y-1">
                  {items.slice(0, 6).map((r) => (
                    <button
                      key={r.id}
                      onClick={(e) => { e.stopPropagation(); onOpen(r.id); }}
                      className="w-full text-left text-[11px] flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted/60"
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[r.status] ?? "bg-muted")} />
                      <span className="font-medium tabular-nums">
                        {format(new Date(r.start_time), "HH:mm")}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {r.guests?.first_name ?? "Gast"} · {r.party_size}p
                      </span>
                    </button>
                  ))}
                  {items.length > 6 && (
                    <div className="text-[10px] text-muted-foreground text-center">
                      +{items.length - 6} meer
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
