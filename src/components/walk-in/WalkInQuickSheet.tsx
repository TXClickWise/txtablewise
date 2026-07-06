// WalkInQuickSheet — tablet-first snel-plaatsen sheet voor walk-ins.
//
// Doel: een walk-in van 2 personen op een vrije tafel binnen 3-5 seconden.
// - Grote knoppen (≥48px), één-hand bediening, sticky CTA
// - Hergebruikt recommendTables (gedeelde scoring)
// - Plaatst via createWalkIn → book_reservation (channel="walk_in")
// - Geen conflict override; bezette tafels zijn disabled met reden
//
// Optioneel pre-geselecteerde tafel (vanuit Tafelplan / Floor Mode klik)
// of pre-fill vanuit AI Quick Seat parser.

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown, Users, Clock, MapPin, Check, Sparkles, ListChecks,
  AlertTriangle, UserPlus, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { recommendTables, recommendCombinations, type RecTable, type RecReservation, type RecCombination, type ComboSuggestion } from "@/lib/tableRecommendation";
import { createWalkIn, addToWaitlistNow } from "@/services/walkIn";

type Zone = { id: string; name: string };

export type WalkInQuickPrefill = {
  partySize?: number;
  zoneId?: string | null;
  durationMinutes?: number;
  tableId?: string;
  notes?: string;
  firstName?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pre-fill from a clicked table card or AI Quick Seat parser */
  prefill?: WalkInQuickPrefill;
  /** Called after successful placement so parent can react (refresh, toast). */
  onPlaced?: (reservationId: string, tableId: string | null) => void;
};

const PARTY_BUTTONS = [1, 2, 3, 4, 5];
const DURATION_OPTIONS = [45, 60, 75, 90, 120];

export function WalkInQuickSheet({ open, onOpenChange, prefill, onPlaced }: Props) {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const restaurant = (current as { restaurants?: Record<string, unknown> } | null)?.restaurants ?? {};
  const defaultDuration = (restaurant.walkin_default_minutes as number | undefined) ?? 75;
  const largeGroupThreshold = (restaurant.large_group_threshold as number | undefined) ?? 9;
  const qc = useQueryClient();

  const [partySize, setPartySize] = useState<number>(2);
  const [partySizeOver, setPartySizeOver] = useState<number>(6);
  const [zoneId, setZoneId] = useState<string | "any">("any");
  const [duration, setDuration] = useState<number>(defaultDuration);
  const [tableId, setTableId] = useState<string | null>(null);
  const [comboId, setComboId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Reset and apply prefill on open
  useEffect(() => {
    if (!open) return;
    setPartySize(prefill?.partySize ?? 2);
    setPartySizeOver(prefill?.partySize && prefill.partySize >= 6 ? prefill.partySize : 6);
    setZoneId(prefill?.zoneId ?? "any");
    setDuration(prefill?.durationMinutes ?? defaultDuration);
    setTableId(prefill?.tableId ?? null);
    setComboId(null);
    setFirstName(prefill?.firstName ?? "");
    setPhone("");
    setNotes(prefill?.notes ?? "");
    setSubmitting(false);
    setMoreOpen(!!(prefill?.firstName || prefill?.notes || prefill?.durationMinutes));
  }, [open, prefill, defaultDuration]);

  const { data: zones = [] } = useQuery({
    queryKey: ["zones", restaurantId],
    enabled: !!restaurantId && open,
    queryFn: async () => {
      const { data } = await supabase.from("zones").select("id, name")
        .eq("restaurant_id", restaurantId!).eq("is_active", true).order("sort_order");
      return (data ?? []) as Zone[];
    },
  });

  const { data: tables = [] } = useQuery({
    queryKey: ["tables", restaurantId],
    enabled: !!restaurantId && open,
    queryFn: async () => {
      const { data } = await supabase.from("tables")
        .select("id, label, zone_id, capacity_min, capacity_max, combinable, shape")
        .eq("restaurant_id", restaurantId!).eq("is_active", true);
      return (data ?? []) as RecTable[];
    },
  });

  const { data: combinations = [] } = useQuery({
    queryKey: ["table-combinations", restaurantId],
    enabled: !!restaurantId && open,
    queryFn: async () => {
      const { data } = await supabase.from("table_combinations")
        .select("id, name, table_ids, capacity_min, capacity_max")
        .eq("restaurant_id", restaurantId!).eq("is_active", true)
        .order("capacity_max", { ascending: true });
      return (data ?? []) as RecCombination[];
    },
  });


  const today = format(new Date(), "yyyy-MM-dd");
  const { data: reservations = [], isLoading: resLoading } = useQuery({
    queryKey: ["walkin-quick-reservations", restaurantId, today],
    enabled: !!restaurantId && open,
    queryFn: async () => {
      const { data } = await supabase.from("reservations")
        .select("id, start_time, end_time, status, reservation_tables(table_id)")
        .eq("restaurant_id", restaurantId!).eq("reservation_date", today)
        .in("status", ["pending", "confirmed", "seated"]);
      return (data ?? []) as unknown as RecReservation[];
    },
  });

  const effectivePartySize = partySize >= 6 ? partySizeOver : partySize;
  const effectiveZoneId = zoneId === "any" ? null : zoneId;

  const allSuggestions = useMemo(() => recommendTables(tables, reservations, {
    partySize: effectivePartySize,
    zoneId: effectiveZoneId,
    durationMinutes: duration,
    includeBlocked: true,
    largeGroupThreshold,
  }), [tables, reservations, effectivePartySize, effectiveZoneId, duration, largeGroupThreshold]);

  const allComboSuggestions = useMemo(() => recommendCombinations(combinations, tables, reservations, {
    partySize: effectivePartySize,
    zoneId: effectiveZoneId,
    durationMinutes: duration,
    includeBlocked: true,
    largeGroupThreshold,
  }), [combinations, tables, reservations, effectivePartySize, effectiveZoneId, duration, largeGroupThreshold]);

  const availableSuggestions = allSuggestions.filter(s => !s.blockReason);
  const availableCombos = allComboSuggestions.filter(s => !s.blockReason);

  // Merge & sort by score; take top 3 for recommended list
  const mergedRecommended = useMemo(() => {
    const singles = availableSuggestions.map((s) => ({
      kind: "table" as const, score: s.score, single: s, combo: null as ComboSuggestion | null,
    }));
    const combos = availableCombos.map((s) => ({
      kind: "combo" as const, score: s.score, single: null, combo: s,
    }));
    return [...singles, ...combos].sort((a, b) => b.score - a.score).slice(0, 3);
  }, [availableSuggestions, availableCombos]);

  const noTablesAvailable = !resLoading && availableSuggestions.length === 0 && availableCombos.length === 0;

  // Selected validation
  const selectedSuggestion = tableId ? allSuggestions.find(s => s.table.id === tableId) : null;
  const selectedCombo = comboId ? allComboSuggestions.find(s => s.combinationId === comboId) : null;
  const selectedHasConflict = !!selectedSuggestion?.blockReason || !!selectedCombo?.blockReason;
  const hasSelection = !!tableId || !!comboId;

  const pickTable = (id: string) => { setTableId(id); setComboId(null); };
  const pickCombo = (id: string) => { setComboId(id); setTableId(null); };

  // Auto-pick top recommendation when none chosen yet
  useEffect(() => {
    if (!open || hasSelection) return;
    const top = mergedRecommended[0];
    if (!top) return;
    if (top.kind === "table") setTableId(top.single!.table.id);
    else setComboId(top.combo!.combinationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasSelection, mergedRecommended]);

  const endTimeLabel = useMemo(() => {
    const end = new Date(Date.now() + duration * 60_000);
    return format(end, "HH:mm");
  }, [duration]);

  if (!restaurantId) return null;

  const handlePlace = async () => {
    if (submitting) return;
    if (!hasSelection) {
      toast.error("Kies een tafel of combinatie.");
      return;
    }
    if (selectedHasConflict) {
      toast.error("Deze tafel/combinatie is niet beschikbaar.");
      return;
    }
    setSubmitting(true);
    const result = await createWalkIn({
      restaurantId,
      partySize: effectivePartySize,
      tableId: tableId ?? undefined,
      tableIds: selectedCombo ? selectedCombo.tableIds : undefined,
      combinationId: selectedCombo ? selectedCombo.combinationId : undefined,
      durationMinutes: duration,
      guest: {
        firstName: firstName.trim() || undefined,
        phone: phone.trim() || undefined,
      },
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Walk-in plaatsen mislukt.");
      return;
    }
    const placedLabel = selectedCombo
      ? selectedCombo.name || selectedCombo.tables.map((t) => t.label).join(" + ")
      : tables.find(t => t.id === (result.reservation?.table_id ?? tableId))?.label;
    toast.success(
      `Walk-in geplaatst${placedLabel ? ` aan ${selectedCombo ? "combinatie " : "tafel "}${placedLabel}` : ""}.`,
    );
    qc.invalidateQueries();
    onPlaced?.(result.reservation!.id, result.reservation?.table_id ?? null);
    onOpenChange(false);
  };


  const handleWaitlist = async () => {
    if (submitting) return;
    setSubmitting(true);
    const result = await addToWaitlistNow({
      restaurantId,
      partySize: effectivePartySize,
      firstName: firstName.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Toevoegen aan wachtlijst mislukt.");
      return;
    }
    toast.success("Op wachtlijst gezet. Krijg je tafel vrij dan kun je de gast erbij halen.");
    qc.invalidateQueries({ queryKey: ["waitlist"] });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[92vh] overflow-y-auto p-0"
      >
        <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-border sticky top-0 bg-background z-10">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-primary" /> Walk-in snel plaatsen
            </SheetTitle>
            <SheetDescription>
              {format(new Date(), "EEEE d MMMM · HH:mm", { locale: nl })} ·
              {" "}Alleen aantal personen volstaat — naam en telefoon zijn optioneel.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-6">
          {/* Stap 1 — Aantal personen */}
          <section>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" /> Aantal personen
            </h3>
            <div className="grid grid-cols-6 gap-2">
              {PARTY_BUTTONS.map(n => (
                <Button
                  key={n}
                  type="button"
                  variant={partySize === n ? "default" : "outline"}
                  className="h-14 text-2xl font-display"
                  onClick={() => { setPartySize(n); setTableId(null); }}
                >
                  {n}
                </Button>
              ))}
              <Button
                type="button"
                variant={partySize >= 6 ? "default" : "outline"}
                className="h-14 text-xl font-display"
                onClick={() => { setPartySize(6); setTableId(null); }}
              >
                6+
              </Button>
            </div>
            {partySize >= 6 && (
              <div className="mt-3 flex items-center gap-2">
                <Label htmlFor="walkin-bigparty" className="text-sm text-muted-foreground">
                  Exact aantal:
                </Label>
                <Input
                  id="walkin-bigparty"
                  type="number"
                  min={6} max={50}
                  value={partySizeOver}
                  onChange={(e) => {
                    const n = Math.max(6, Math.min(50, parseInt(e.target.value) || 6));
                    setPartySizeOver(n);
                    setTableId(null);
                  }}
                  className="h-12 w-24 text-lg"
                />
                {effectivePartySize >= largeGroupThreshold && (
                  <span className="text-xs rounded-full px-2 py-0.5 bg-warning/15 text-warning border border-warning/30">
                    Grote groep
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Stap 2 — Zone */}
          {zones.length > 0 && (
            <section>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground" /> Waar wil je ze plaatsen?
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={zoneId === "any" ? "default" : "outline"}
                  className="h-12 px-4"
                  onClick={() => { setZoneId("any"); setTableId(null); }}
                >
                  Geen voorkeur
                </Button>
                {zones.map(z => (
                  <Button
                    key={z.id}
                    type="button"
                    variant={zoneId === z.id ? "default" : "outline"}
                    className="h-12 px-4"
                    onClick={() => { setZoneId(z.id); setTableId(null); }}
                  >
                    {z.name}
                  </Button>
                ))}
              </div>
            </section>
          )}

          {/* Stap 3 — Tafelaanbeveling + handmatige keuze */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Beste tafel
              </h3>
              <span className="text-xs text-muted-foreground">
                Eindtijd ± {endTimeLabel}
              </span>
            </div>

            {resLoading ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Tafels controleren…
              </div>
            ) : noTablesAvailable ? (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm space-y-3">
                <div className="flex items-start gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="text-foreground">
                    Geen passende tafel vrij voor {effectivePartySize} personen
                    {effectiveZoneId ? ` in deze zone` : ""}.
                    Probeer een andere zone, of zet de gast op de wachtlijst.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {effectiveZoneId && (
                    <Button size="sm" variant="outline" onClick={() => setZoneId("any")}>
                      Andere zone proberen
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={handleWaitlist} disabled={submitting}>
                    <ListChecks className="mr-1.5 h-4 w-4" /> Op wachtlijst
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {recommended.map((s, idx) => (
                  <button
                    key={s.table.id}
                    type="button"
                    onClick={() => setTableId(s.table.id)}
                    className={cn(
                      "w-full text-left rounded-xl border-2 p-3 transition-all active:scale-[0.99]",
                      tableId === s.table.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-12 w-12 flex items-center justify-center font-display text-lg border-2 shrink-0",
                        s.table.shape === "round" ? "rounded-full" : "rounded-md",
                        tableId === s.table.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted",
                      )}>
                        {s.table.label}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          Tafel {s.table.label}
                          {idx === 0 && (
                            <span className="text-[10px] uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                              Aanbevolen
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.table.capacity_min}-{s.table.capacity_max}p ·
                          {" "}{zones.find(z => z.id === s.table.zone_id)?.name ?? "Geen zone"}
                          {s.freeUntilLabel && <> · vrij tot {s.freeUntilLabel}</>}
                        </div>
                      </div>
                      {tableId === s.table.id && (
                        <Check className="h-5 w-5 text-primary shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Manual table picker */}
            {!noTablesAvailable && (
              <Collapsible className="mt-3">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Liever zelf een tafel kiezen
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {allSuggestions.map(s => {
                      const blocked = !!s.blockReason;
                      const isSelected = tableId === s.table.id;
                      return (
                        <button
                          key={s.table.id}
                          type="button"
                          disabled={blocked}
                          title={s.blockReason ?? ""}
                          onClick={() => setTableId(s.table.id)}
                          className={cn(
                            "h-16 rounded-lg border-2 px-2 py-1 text-left transition-all",
                            blocked
                              ? "opacity-40 cursor-not-allowed border-border bg-muted"
                              : isSelected
                                ? "border-primary bg-primary/10"
                                : "border-border bg-card hover:border-primary/40",
                          )}
                        >
                          <div className="font-display text-base leading-tight">
                            Tafel {s.table.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {blocked ? s.blockReason : `${s.table.capacity_min}-${s.table.capacity_max}p`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </section>

          {/* Gast (optioneel) — altijd zichtbaar voor snelle invoer */}
          <section>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-muted-foreground" /> Gast (optioneel)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={firstName}
                maxLength={100}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-12"
                placeholder="Naam"
                autoComplete="off"
              />
              <Input
                value={phone}
                maxLength={40}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12"
                placeholder="Telefoon"
                inputMode="tel"
                autoComplete="off"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Niet nodig voor snelle plaatsing — laat leeg om direct te plaatsen.
            </p>
          </section>

          {/* Meer opties */}
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between h-11">
                Meer opties
                <ChevronDown className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-4">
              <div>
                <Label className="text-sm flex items-center gap-1.5 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" /> Verwachte duur
                </Label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map(m => (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={duration === m ? "default" : "outline"}
                      className="h-10 px-3"
                      onClick={() => setDuration(m)}
                    >
                      {m} min
                    </Button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Verwachte eindtijd: {endTimeLabel}</p>
              </div>
              <div>
                <Label htmlFor="walkin-notes" className="text-sm">Notitie (optioneel)</Label>
                <Textarea
                  id="walkin-notes"
                  value={notes}
                  maxLength={500}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1"
                  placeholder="Allergie, voorkeur, kinderstoel…"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Soft warnings on selected table */}
          {selectedSuggestion && !selectedHasConflict && selectedSuggestion.table.capacity_min > effectivePartySize && (
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-warning" />
              Deze tafel heeft een minimum aan personen — controleer of dit de beste keuze is.
            </div>
          )}
        </div>

        {/* Sticky CTA */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border px-5 sm:px-6 py-3 flex items-center gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuleren
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 text-base"
            disabled={submitting || !tableId || selectedHasConflict || noTablesAvailable}
            onClick={handlePlace}
          >
            {submitting ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Bezig…</>
            ) : (
              <><Check className="mr-2 h-5 w-5" /> Plaats nu</>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
