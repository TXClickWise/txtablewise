import { useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelBadge } from "@/components/ChannelBadge";
import { cn } from "@/lib/utils";

const ReservationsPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ["reservations-day", restaurantId, dateStr],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("reservations")
        .select("id, start_time, party_size, status, channel, special_requests, confirmation_code, guests(first_name, last_name, phone, email), reservation_tables(tables(label))")
        .eq("restaurant_id", restaurantId!).eq("reservation_date", dateStr)
        .order("start_time");
      return data ?? [];
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Reserveringen</h1>
          <p className="text-muted-foreground capitalize">{format(date, "EEEE d MMMM yyyy", { locale: nl })}</p>
        </div>
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
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-lg">{reservations.length} reserveringen</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden…</div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Geen reserveringen op deze dag.</div>
          ) : (
            <div className="divide-y divide-border">
              {reservations.map((r: never) => {
                const res = r as unknown as {
                  id: string; start_time: string; party_size: number; status: string; channel: string;
                  special_requests: string | null; confirmation_code: string | null;
                  guests: { first_name: string; last_name: string | null; phone: string | null; email: string } | null;
                  reservation_tables: { tables: { label: string } }[];
                };
                return (
                  <div key={res.id} className="py-4 flex items-center gap-4 flex-wrap">
                    <div className="text-center min-w-[60px]">
                      <div className="font-display text-lg">{format(new Date(res.start_time), "HH:mm")}</div>
                      <div className="text-xs text-muted-foreground">{res.party_size}p</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{res.guests?.first_name} {res.guests?.last_name ?? ""}</span>
                        <StatusBadge status={res.status as never} />
                        <ChannelBadge channel={res.channel as never} />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {res.guests?.email} {res.guests?.phone && `· ${res.guests.phone}`}
                        {res.reservation_tables.length > 0 && ` · Tafel ${res.reservation_tables.map((rt) => rt.tables?.label).join(", ")}`}
                      </div>
                      {res.special_requests && <div className="text-sm mt-1 text-muted-foreground italic">"{res.special_requests}"</div>}
                    </div>
                    {res.confirmation_code && <div className="font-mono text-xs text-muted-foreground">{res.confirmation_code}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReservationsPage;
