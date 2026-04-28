import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { Plus, Search, Users } from "lucide-react";

import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, LoadingState } from "@/components/touch/StateViews";
import { WaitlistCard } from "@/components/waitlist/WaitlistCard";
import { WaitlistFormSheet } from "@/components/waitlist/WaitlistFormSheet";
import { WaitlistDetailDialog } from "@/components/waitlist/WaitlistDetailDialog";
import { LastMinuteFillPanel } from "@/components/waitlist/LastMinuteFillPanel";
import type { WaitlistEntry, WaitlistStatus } from "@/services/waitlist";

type DateFilter = "today" | "tomorrow" | "week" | "all";
type StatusFilter = "all" | "active" | WaitlistStatus;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Actief" },
  { value: "all", label: "Alle" },
  { value: "waiting", label: "Wacht op plek" },
  { value: "matched", label: "Match" },
  { value: "notified", label: "Bericht voorbereid" },
  { value: "converted", label: "Omgezet" },
  { value: "expired", label: "Verlopen" },
  { value: "cancelled", label: "Geannuleerd" },
];

const WaitlistPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();

  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<WaitlistEntry | null>(null);
  const [detailEntry, setDetailEntry] = useState<WaitlistEntry | null>(null);

  // Date range
  const { from, to } = useMemo(() => {
    const now = new Date();
    if (dateFilter === "today") return { from: format(now, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    if (dateFilter === "tomorrow") {
      const t = addDays(now, 1);
      return { from: format(t, "yyyy-MM-dd"), to: format(t, "yyyy-MM-dd") };
    }
    if (dateFilter === "week") return { from: format(now, "yyyy-MM-dd"), to: format(addDays(now, 6), "yyyy-MM-dd") };
    return { from: null, to: null };
  }, [dateFilter]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["waitlist", restaurantId, from, to],
    enabled: !!restaurantId,
    queryFn: async () => {
      let q = supabase
        .from("waitlist_entries")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("desired_date", { ascending: true })
        .order("desired_time_from", { ascending: true });
      if (from && to) q = q.gte("desired_date", from).lte("desired_date", to);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as WaitlistEntry[];
    },
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["zones-list", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("zones").select("id, name").eq("restaurant_id", restaurantId!);
      return data || [];
    },
  });
  const zoneById = useMemo(() => Object.fromEntries(zones.map((z) => [z.id, z.name])), [zones]);

  // Realtime
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`waitlist-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waitlist_entries", filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ["waitlist"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, qc]);

  // Apply status + search filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (statusFilter === "active") {
        if (!["waiting", "matched", "notified", "confirmed"].includes(e.status)) return false;
      } else if (statusFilter !== "all" && e.status !== statusFilter) {
        return false;
      }
      if (q) {
        const hay = [e.first_name, e.last_name, e.phone, e.email, e.notes]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, statusFilter, search]);

  // KPIs
  const kpis = useMemo(() => {
    const active = entries.filter((e) =>
      ["waiting", "matched", "notified", "confirmed"].includes(e.status),
    ).length;
    const matched = entries.filter((e) => e.status === "matched" || e.status === "notified").length;
    const today = format(new Date(), "yyyy-MM-dd");
    const todayCount = entries.filter((e) =>
      e.desired_date === today &&
      ["waiting", "matched", "notified", "confirmed"].includes(e.status),
    ).length;
    const converted = entries.filter((e) => e.status === "converted").length;
    const expired = entries.filter((e) => e.status === "expired").length;
    return { active, matched, todayCount, converted, expired };
  }, [entries]);

  if (!restaurantId) {
    return <div className="p-6 text-muted-foreground">Geen restaurant geselecteerd.</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Wachtlijst"
        description="Voorkom lege tafels — vul vrijgekomen plekken snel en gastvrij opnieuw op."
        actions={
          <Button size="lg" className="h-11" onClick={() => { setEditEntry(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Wachtlijstitem
          </Button>
        }
      />

      <LastMinuteFillPanel restaurantId={restaurantId} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Actief" value={kpis.active} tone="premium" />
        <KpiCard label="Vandaag te vullen" value={kpis.todayCount} accent="primary" />
        <KpiCard label="Bericht voorbereid" value={kpis.matched} />
        <KpiCard label="Omgezet" value={kpis.converted} accent="success" />
        <KpiCard label="Verlopen" value={kpis.expired} accent="warning" />
      </div>

      <Card className="p-4 space-y-4 bg-gradient-card shadow-soft">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <TabsList>
              <TabsTrigger value="today">Vandaag</TabsTrigger>
              <TabsTrigger value="tomorrow">Morgen</TabsTrigger>
              <TabsTrigger value="week">Deze week</TabsTrigger>
              <TabsTrigger value="all">Alles</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek naam, telefoon, e-mail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={statusFilter === t.value ? "default" : "outline"}
              onClick={() => setStatusFilter(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        {isLoading && <LoadingState label="Wachtlijst laden…" />}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            icon={<Users />}
            title="Geen wachtlijstitems gevonden"
            description="Er staan momenteel geen gasten op de wachtlijst voor deze selectie."
            action={
              <Button onClick={() => { setEditEntry(null); setFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Wachtlijstitem
              </Button>
            }
          />
        )}
        {filtered.map((e) => (
          <WaitlistCard
            key={e.id}
            entry={e}
            zoneName={e.zone_preference ? zoneById[e.zone_preference] : null}
            onOpen={(entry) => setDetailEntry(entry)}
          />
        ))}
      </div>

      <WaitlistFormSheet
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditEntry(null); }}
        restaurantId={restaurantId}
        entry={editEntry}
        onSaved={() => qc.invalidateQueries({ queryKey: ["waitlist"] })}
      />

      <WaitlistDetailDialog
        entry={detailEntry}
        open={!!detailEntry}
        onOpenChange={(o) => { if (!o) setDetailEntry(null); }}
        onEdit={(entry) => { setDetailEntry(null); setEditEntry(entry); setFormOpen(true); }}
      />
    </div>
  );
};

export default WaitlistPage;
