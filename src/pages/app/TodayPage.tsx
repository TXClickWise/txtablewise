import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarDays, UserPlus, Users, Clock, TrendingUp, Sparkles, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { WalkInDialog } from "@/components/WalkInDialog";
import { ReservationDetailDialog } from "@/components/ReservationDetailDialog";
import { ReservationCard, type CardReservation } from "@/components/reservations/ReservationCard";
import { ReservationFormSheet } from "@/components/reservations/ReservationFormSheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LastMinuteFillPanel } from "@/components/waitlist/LastMinuteFillPanel";

const TodayPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

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

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ["reservations-today", restaurantId, today],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(`
          id, start_time, end_time, party_size, status, channel, special_requests,
          internal_notes, occasion, dietary_notes, confirmation_code,
          requires_manual_approval, large_group_status, reminder_confirmed_at,
          guests(first_name, last_name, phone, email, is_vip, allergies),
          reservation_tables(tables(label)),
          pre_orders(id)
        `)
        .eq("restaurant_id", restaurantId!)
        .eq("reservation_date", today)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CardReservation[];
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
      ["confirmed", "seated", "completed", "finished", "pending"].includes(r.status) ? sum + r.party_size : sum, 0);
    const seated = reservations.filter((r) => r.status === "seated").length;
    const noShows = reservations.filter((r) => r.status === "no_show").length;
    return { guestsTotal, seated, noShows };
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

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Vandaag</h1>
          <p className="text-muted-foreground capitalize">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: nl })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tableCount === 0 && (
            <Button onClick={handleSeed} disabled={seeding} variant="outline" className="h-11">
              <Sparkles className="mr-2 h-4 w-4" />
              {seeding ? "Bezig…" : "Demo-data inladen"}
            </Button>
          )}
          <Button variant="outline" className="h-11" onClick={() => setWalkInOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Walk-in
          </Button>
          <Button className="h-11" onClick={() => setCreateOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" /> Reservering
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Gasten verwacht" value={kpis.guestsTotal} icon={<Users className="h-5 w-5" />} />
        <KpiCard label="Reserveringen" value={reservations.length} icon={<CalendarDays className="h-5 w-5" />} />
        <KpiCard label="Aan tafel" value={kpis.seated} icon={<Clock className="h-5 w-5" />} />
        <KpiCard label="No-shows" value={kpis.noShows} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      {restaurantId && <LastMinuteFillPanel restaurantId={restaurantId} />}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Reserveringen vandaag</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-3">
              <CalendarDays className="h-10 w-10 mx-auto opacity-40" />
              <p>Vandaag staan er nog geen reserveringen gepland.</p>
              {tableCount === 0 && (
                <p className="text-sm">Klik op "Demo-data inladen" om snel aan de slag te gaan.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {reservations.map((r) => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  onOpen={setSelectedId}
                  largeGroupThreshold={largeGroupThreshold}
                  invalidateKeys={["reservations-today"]}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} />
      <ReservationFormSheet open={createOpen} onOpenChange={setCreateOpen} />
      <ReservationDetailDialog reservationId={selectedId} open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </div>
  );
};

export default TodayPage;

