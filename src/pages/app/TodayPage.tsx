import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarDays, UserPlus, Users, Clock, TrendingUp, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelBadge } from "@/components/ChannelBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { WalkInDialog } from "@/components/WalkInDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Reservation = {
  id: string;
  start_time: string;
  end_time: string;
  party_size: number;
  status: string;
  channel: string;
  special_requests: string | null;
  occasion: string | null;
  guests: { first_name: string; last_name: string | null; phone: string | null; is_vip: boolean } | null;
  reservation_tables: { tables: { label: string } }[];
};

const TodayPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ["reservations-today", restaurantId, today],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(`
          id, start_time, end_time, party_size, status, channel, special_requests, occasion,
          guests(first_name, last_name, phone, is_vip),
          reservation_tables(tables(label))
        `)
        .eq("restaurant_id", restaurantId!)
        .eq("reservation_date", today)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Reservation[];
    },
  });

  const { data: tableCount = 0 } = useQuery({
    queryKey: ["table-count", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { count } = await supabase
        .from("tables").select("*", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId!).eq("is_active", true);
      return count ?? 0;
    },
  });

  // Realtime updates
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase.channel(`res-${restaurantId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ["reservations-today", restaurantId, today] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, qc, today]);

  const kpis = useMemo(() => {
    const guestsTotal = reservations.reduce((sum, r) =>
      ["confirmed", "seated", "finished", "pending"].includes(r.status) ? sum + r.party_size : sum, 0);
    const seated = reservations.filter((r) => r.status === "seated").length;
    const upcoming = reservations.filter((r) => ["confirmed", "pending"].includes(r.status) && new Date(r.start_time) >= new Date()).length;
    const noShows = reservations.filter((r) => r.status === "no_show").length;
    return { guestsTotal, seated, upcoming, noShows };
  }, [reservations]);

  const handleSeed = async () => {
    if (!restaurantId) return;
    setSeeding(true);
    const { data, error } = await supabase.functions.invoke("seed_demo_data", {
      body: { restaurant_id: restaurantId },
    });
    setSeeding(false);
    if (error || data?.error) {
      toast.error(data?.error || "Demo-data inserten mislukt");
      return;
    }
    if (data?.skipped) toast.info("Demo-data was al aanwezig");
    else toast.success("Demo-data toegevoegd: zones, 13 tafels, openingstijden en shifts");
    qc.invalidateQueries();
  };

  const updateStatus = async (id: string, status: "confirmed" | "seated" | "finished" | "no_show" | "cancelled") => {
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["reservations-today", restaurantId, today] });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Vandaag</h1>
          <p className="text-muted-foreground capitalize">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: nl })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tableCount === 0 && (
            <Button onClick={handleSeed} disabled={seeding} variant="outline">
              <Sparkles className="mr-2 h-4 w-4" />
              {seeding ? "Bezig…" : "Demo-data inladen"}
            </Button>
          )}
          <Button onClick={() => setWalkInOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Walk-in / Boeking
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Gasten verwacht" value={kpis.guestsTotal} icon={<Users className="h-5 w-5" />} />
        <KpiCard label="Reserveringen" value={reservations.length} icon={<CalendarDays className="h-5 w-5" />} />
        <KpiCard label="Aan tafel" value={kpis.seated} icon={<Clock className="h-5 w-5" />} />
        <KpiCard label="No-shows" value={kpis.noShows} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Reserveringen vandaag</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm py-8 text-center">Laden…</div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nog geen reserveringen vandaag.</p>
              {tableCount === 0 && (
                <p className="text-sm mt-2">Klik op "Demo-data inladen" om snel aan de slag te gaan.</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {reservations.map((r) => (
                <div key={r.id} className="py-4 flex items-center gap-4 flex-wrap">
                  <div className="text-center min-w-[64px]">
                    <div className="font-display text-xl">{format(new Date(r.start_time), "HH:mm")}</div>
                    <div className="text-xs text-muted-foreground">{r.party_size}p</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {r.guests?.first_name} {r.guests?.last_name ?? ""}
                      </span>
                      {r.guests?.is_vip && <span className="text-xs bg-accent/30 text-accent-foreground px-1.5 py-0.5 rounded">VIP</span>}
                      <StatusBadge status={r.status as never} />
                      <ChannelBadge channel={r.channel as never} />
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {r.reservation_tables?.length > 0 && (
                        <span>Tafel {r.reservation_tables.map((rt) => rt.tables?.label).join(", ")} · </span>
                      )}
                      {r.guests?.phone && <span>{r.guests.phone}</span>}
                      {r.special_requests && <span> · {r.special_requests}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {r.status === "confirmed" && (
                      <Button size="sm" variant="default" onClick={() => updateStatus(r.id, "seated")}>Aan tafel</Button>
                    )}
                    {r.status === "seated" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "finished")}>Afgerekend</Button>
                    )}
                    {["confirmed", "pending"].includes(r.status) && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "no_show")}>No-show</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} />
    </div>
  );
};

export default TodayPage;
