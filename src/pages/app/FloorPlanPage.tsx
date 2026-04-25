import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Zone = { id: string; name: string };
type Table = {
  id: string; label: string; zone_id: string | null;
  capacity_min: number; capacity_max: number;
  pos_x: number; pos_y: number; width: number; height: number; shape: string;
};
type Res = {
  id: string; start_time: string; end_time: string; status: string; party_size: number;
  guests: { first_name: string; last_name: string | null; is_vip: boolean } | null;
  reservation_tables: { table_id: string }[];
};

const FloorPlanPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: zones = [] } = useQuery({
    queryKey: ["zones", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("zones").select("id, name")
        .eq("restaurant_id", restaurantId!).eq("is_active", true).order("sort_order");
      return (data ?? []) as Zone[];
    },
  });

  useEffect(() => {
    if (!zoneId && zones.length > 0) setZoneId(zones[0].id);
  }, [zones, zoneId]);

  const { data: tables = [] } = useQuery({
    queryKey: ["tables", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("tables").select("*")
        .eq("restaurant_id", restaurantId!).eq("is_active", true);
      return (data ?? []) as Table[];
    },
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ["reservations-today-full", restaurantId, today],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("reservations")
        .select("id, start_time, end_time, status, party_size, guests(first_name, last_name, is_vip), reservation_tables(table_id)")
        .eq("restaurant_id", restaurantId!).eq("reservation_date", today)
        .in("status", ["confirmed", "seated", "pending", "hold"]);
      return (data ?? []) as unknown as Res[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase.channel(`floor-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ["reservations-today-full", restaurantId, today] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "reservation_tables" },
        () => qc.invalidateQueries({ queryKey: ["reservations-today-full", restaurantId, today] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, qc, today]);

  // Map: table_id -> current/next reservation status
  const tableState = useMemo(() => {
    const now = new Date();
    const map = new Map<string, { status: "free" | "seated" | "soon" | "later"; res?: Res }>();
    for (const t of tables) map.set(t.id, { status: "free" });
    for (const r of reservations) {
      const start = new Date(r.start_time);
      const end = new Date(r.end_time);
      let kind: "seated" | "soon" | "later" = "later";
      if (r.status === "seated" || (now >= start && now < end)) kind = "seated";
      else if (start.getTime() - now.getTime() < 60 * 60_000 && start > now) kind = "soon";
      else if (start > now) kind = "later";
      else continue;
      for (const rt of r.reservation_tables) {
        const existing = map.get(rt.table_id);
        // Prefer seated > soon > later
        const order = { seated: 3, soon: 2, later: 1, free: 0 };
        if (!existing || order[kind] > order[existing.status]) map.set(rt.table_id, { status: kind, res: r });
      }
    }
    return map;
  }, [tables, reservations]);

  const visibleTables = tables.filter((t) => t.zone_id === zoneId);

  const colorFor = (s: string) => {
    switch (s) {
      case "seated": return "bg-primary text-primary-foreground border-primary";
      case "soon": return "bg-accent/40 border-accent text-accent-foreground";
      case "later": return "bg-secondary border-border text-secondary-foreground";
      default: return "bg-card border-border text-muted-foreground";
    }
  };

  if (tables.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nog geen tafels geconfigureerd.</p>
            <p className="text-sm mt-1">Ga naar Vandaag en klik "Demo-data inladen", of voeg tafels toe via Instellingen.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Tafelplan</h1>
          <p className="text-muted-foreground capitalize">{format(new Date(), "EEEE d MMMM", { locale: nl })}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <LegendDot className="bg-card border-border" label="Vrij" />
          <LegendDot className="bg-secondary border-border" label="Later" />
          <LegendDot className="bg-accent/40 border-accent" label="Binnen 1u" />
          <LegendDot className="bg-primary border-primary" label="Aan tafel" />
        </div>
      </div>

      {zones.length > 1 && (
        <Tabs value={zoneId ?? ""} onValueChange={setZoneId}>
          <TabsList>
            {zones.map((z) => <TabsTrigger key={z.id} value={z.id}>{z.name}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg">{zones.find((z) => z.id === zoneId)?.name ?? "Zone"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full bg-muted/30 rounded-lg border border-border overflow-auto" style={{ minHeight: 520 }}>
            <div className="relative" style={{ width: 720, height: 520 }}>
              {visibleTables.map((t) => {
                const st = tableState.get(t.id) ?? { status: "free" as const };
                const isRound = t.shape === "round";
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "absolute flex flex-col items-center justify-center text-xs font-medium border-2 transition-colors shadow-sm select-none",
                      isRound ? "rounded-full" : "rounded-md",
                      colorFor(st.status),
                    )}
                    style={{ left: t.pos_x, top: t.pos_y, width: t.width, height: t.height }}
                    title={st.res ? `${st.res.guests?.first_name ?? ""} · ${st.res.party_size}p` : `Vrij · ${t.capacity_min}-${t.capacity_max}p`}
                  >
                    <div className="font-display text-base">{t.label}</div>
                    {st.res ? (
                      <div className="text-[10px] truncate max-w-[70px] leading-tight">
                        {st.res.guests?.first_name ?? "Gast"}<br />
                        {format(new Date(st.res.start_time), "HH:mm")} · {st.res.party_size}p
                      </div>
                    ) : (
                      <div className="text-[10px] opacity-70">{t.capacity_min}-{t.capacity_max}p</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const LegendDot = ({ className, label }: { className: string; label: string }) => (
  <div className="flex items-center gap-1.5">
    <div className={cn("h-3 w-3 rounded border", className)} />
    <span className="text-muted-foreground">{label}</span>
  </div>
);

export default FloorPlanPage;
