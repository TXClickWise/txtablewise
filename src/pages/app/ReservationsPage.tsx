import { useMemo, useState } from "react";
import { format, addDays, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Search,
  CalendarPlus, UserPlus, RotateCw, Filter, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ReservationDetailDialog } from "@/components/ReservationDetailDialog";
import { ReservationCard, type CardReservation } from "@/components/reservations/ReservationCard";
import { ReservationFormSheet } from "@/components/reservations/ReservationFormSheet";
import { WalkInDialog } from "@/components/WalkInDialog";
import { cn } from "@/lib/utils";

type StatusFilter =
  | "all" | "pending" | "confirmed" | "seated" | "completed" | "cancelled" | "no_show";

const STATUS_CHIPS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all",       label: "Alle" },
  { key: "pending",   label: "In afwachting" },
  { key: "confirmed", label: "Bevestigd" },
  { key: "seated",    label: "Aan tafel" },
  { key: "completed", label: "Afgerond" },
  { key: "cancelled", label: "Geannuleerd" },
  { key: "no_show",   label: "No-show" },
];

type SignalFilter = null | "walk_in" | "large_group" | "allergy" | "preorder" | "approval";

const ReservationsPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const [date, setDate] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [signal, setSignal] = useState<SignalFilter>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const dateStr = format(date, "yyyy-MM-dd");

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

  const { data: reservations = [], isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["reservations-day", restaurantId, dateStr],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("reservations")
        .select(`
          id, start_time, end_time, party_size, status, channel, special_requests,
          internal_notes, occasion, dietary_notes, confirmation_code,
          requires_manual_approval, large_group_status, reminder_confirmed_at,
          guests(first_name, last_name, phone, email, is_vip, allergies),
          reservation_tables(tables(label)),
          pre_orders(id)
        `)
        .eq("restaurant_id", restaurantId!).eq("reservation_date", dateStr)
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as unknown as CardReservation[];
    },
  });

  const largeGroupThreshold = restaurant?.large_group_threshold ?? 9;

  const filtered = useMemo(() => reservations.filter((r) => {
    if (statusFilter !== "all") {
      // Treat 'finished' as completed for legacy data
      const norm = r.status === "finished" ? "completed" : r.status;
      if (norm !== statusFilter) return false;
    }
    if (signal === "walk_in" && r.channel !== "walk_in") return false;
    if (signal === "large_group" && r.party_size < largeGroupThreshold) return false;
    if (signal === "allergy" && !r.guests?.allergies && !r.dietary_notes) return false;
    if (signal === "preorder" && (r.pre_orders?.length ?? 0) === 0) return false;
    if (signal === "approval" && !r.requires_manual_approval) return false;

    if (search) {
      const q = search.toLowerCase();
      const name = `${r.guests?.first_name ?? ""} ${r.guests?.last_name ?? ""}`.toLowerCase();
      const email = (r.guests?.email ?? "").toLowerCase();
      const phone = (r.guests?.phone ?? "").toLowerCase();
      const code = (r.confirmation_code ?? "").toLowerCase();
      const note = `${r.special_requests ?? ""} ${r.internal_notes ?? ""}`.toLowerCase();
      const tables = (r.reservation_tables ?? []).map((rt) => rt?.tables?.label ?? "").join(" ").toLowerCase();
      if (![name, email, phone, code, note, tables].some((s) => s.includes(q))) return false;
    }
    return true;
  }), [reservations, statusFilter, signal, search, largeGroupThreshold]);

  const counts = useMemo(() => ({
    walk_in:     reservations.filter((r) => r.channel === "walk_in").length,
    large_group: reservations.filter((r) => r.party_size >= largeGroupThreshold).length,
    allergy:     reservations.filter((r) => r.guests?.allergies || r.dietary_notes).length,
    preorder:    reservations.filter((r) => (r.pre_orders?.length ?? 0) > 0).length,
    approval:    reservations.filter((r) => r.requires_manual_approval).length,
  }), [reservations, largeGroupThreshold]);

  const clearAll = () => { setStatusFilter("all"); setSignal(null); setSearch(""); };
  const filtersActive = statusFilter !== "all" || signal !== null || search !== "";

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Reserveringen</h1>
          <p className="text-muted-foreground capitalize text-sm">
            {format(date, "EEEE d MMMM yyyy", { locale: nl })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setDate(subDays(date, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-11">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, "d MMM yyyy", { locale: nl })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} locale={nl} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setDate(addDays(date, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" className="h-11" onClick={() => setWalkInOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Walk-in
          </Button>
          <Button className="h-11" onClick={() => setCreateOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" /> Reservering
          </Button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam, e-mail, telefoon, tafel, notitie of code…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11"
          />
        </div>

        {/* Status chips */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => setStatusFilter(c.key)}
              className={cn(
                "px-3 h-9 rounded-full border text-sm transition-colors",
                statusFilter === c.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Signal chips */}
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1 mr-1">
            <Filter className="h-3 w-3" /> Signalen
          </span>
          <SignalChip active={signal === "walk_in"}     onClick={() => setSignal(signal === "walk_in"     ? null : "walk_in")}     label="Walk-ins"      count={counts.walk_in} />
          <SignalChip active={signal === "large_group"} onClick={() => setSignal(signal === "large_group" ? null : "large_group")} label="Grote groep"   count={counts.large_group} />
          <SignalChip active={signal === "allergy"}     onClick={() => setSignal(signal === "allergy"     ? null : "allergy")}     label="Allergie"      count={counts.allergy} />
          <SignalChip active={signal === "preorder"}    onClick={() => setSignal(signal === "preorder"    ? null : "preorder")}    label="Drankje klaarzetten" count={counts.preorder} />
          <SignalChip active={signal === "approval"}    onClick={() => setSignal(signal === "approval"    ? null : "approval")}    label="Goedkeuring nodig"   count={counts.approval} />
          {filtersActive && (
            <Button variant="ghost" size="sm" className="h-8 ml-1" onClick={clearAll}>
              <X className="h-3 w-3 mr-1" /> Wis filters
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">
              {isLoading ? "Laden…" : `${filtered.length} ${filtered.length === 1 ? "reservering" : "reserveringen"}`}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {dataUpdatedAt > 0 && (
                <span>Bijgewerkt {format(new Date(dataUpdatedAt), "HH:mm")}</span>
              )}
              <Button variant="ghost" size="sm" className="h-8" onClick={() => refetch()}>
                <RotateCw className="h-3 w-3 mr-1" /> Vernieuwen
              </Button>
            </div>
          </div>

          {isError ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-destructive">De reserveringen konden niet worden geladen.</p>
              <Button variant="outline" onClick={() => refetch()}>Opnieuw proberen</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              {filtersActive ? (
                <>
                  <p className="text-muted-foreground">Geen reserveringen gevonden met deze filters.</p>
                  <Button variant="outline" onClick={clearAll}>Filters wissen</Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">Vandaag staan er nog geen reserveringen gepland.</p>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline" onClick={() => setWalkInOpen(true)}>
                      <UserPlus className="mr-2 h-4 w-4" /> Walk-in
                    </Button>
                    <Button onClick={() => setCreateOpen(true)}>
                      <CalendarPlus className="mr-2 h-4 w-4" /> Reservering
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  onOpen={setSelectedId}
                  largeGroupThreshold={largeGroupThreshold}
                  invalidateKeys={["reservations-day"]}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ReservationDetailDialog reservationId={selectedId} open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
      <ReservationFormSheet open={createOpen} onOpenChange={setCreateOpen} />
      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} />
    </div>
  );
};

function SignalChip({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 h-8 rounded-full border text-xs transition-colors inline-flex items-center gap-1.5",
        active
          ? "bg-warning/15 border-warning/40 text-warning"
          : "bg-background border-border hover:border-warning/40",
        count === 0 && "opacity-50",
      )}
    >
      {label}
      {count > 0 && (
        <span className={cn(
          "rounded-full px-1.5 text-[10px] leading-4",
          active ? "bg-warning/30" : "bg-muted",
        )}>{count}</span>
      )}
    </button>
  );
}

export default ReservationsPage;
