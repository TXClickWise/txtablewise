import { useState } from "react";
import { format, addDays, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelBadge } from "@/components/ChannelBadge";
import { ReservationDetailDialog } from "@/components/ReservationDetailDialog";
import { cn } from "@/lib/utils";

const ReservationsPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const [date, setDate] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const filtered = (reservations as any[]).filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${r.guests?.first_name ?? ""} ${r.guests?.last_name ?? ""}`.toLowerCase();
      const email = (r.guests?.email ?? "").toLowerCase();
      const phone = (r.guests?.phone ?? "").toLowerCase();
      const code = (r.confirmation_code ?? "").toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !code.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Reserveringen</h1>
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

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op naam, e-mail, telefoon of code…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="pending">In afwachting</SelectItem>
            <SelectItem value="confirmed">Bevestigd</SelectItem>
            <SelectItem value="seated">Aan tafel</SelectItem>
            <SelectItem value="finished">Afgerekend</SelectItem>
            <SelectItem value="cancelled">Geannuleerd</SelectItem>
            <SelectItem value="no_show">No-show</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-lg">{filtered.length} reserveringen</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Geen reserveringen gevonden.</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((res: any) => (
                <button
                  key={res.id}
                  onClick={() => setSelectedId(res.id)}
                  className="py-4 flex items-center gap-4 flex-wrap w-full text-left hover:bg-muted/40 -mx-3 px-3 rounded-md transition-colors"
                >
                  <div className="text-center min-w-[60px]">
                    <div className="font-display text-lg">{format(new Date(res.start_time), "HH:mm")}</div>
                    <div className="text-xs text-muted-foreground">{res.party_size}p</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{res.guests?.first_name} {res.guests?.last_name ?? ""}</span>
                      <StatusBadge status={res.status as any} />
                      <ChannelBadge channel={res.channel as any} />
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {res.guests?.email} {res.guests?.phone && `· ${res.guests.phone}`}
                      {res.reservation_tables?.length > 0 && ` · Tafel ${res.reservation_tables.map((rt: any) => rt.tables?.label).join(", ")}`}
                    </div>
                    {res.special_requests && <div className="text-sm mt-1 text-muted-foreground italic">"{res.special_requests}"</div>}
                  </div>
                  {res.confirmation_code && <div className="font-mono text-xs text-muted-foreground">{res.confirmation_code}</div>}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ReservationDetailDialog reservationId={selectedId} open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </div>
  );
};

export default ReservationsPage;
