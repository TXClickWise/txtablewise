import { useEffect, useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { reservations as resService } from "@/services/reservations";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Table = { id: string; label: string; capacity_min: number; capacity_max: number; zones?: { name?: string } | null };
type Combination = {
  id: string;
  name: string;
  table_ids: string[];
  capacity_min: number;
  capacity_max: number;
  is_active: boolean;
};

type Picked =
  | { kind: "single"; tableId: string }
  | { kind: "combo"; combinationId: string; tableIds: string[] };

export function AssignTableSheet({
  reservationId,
  restaurantId,
  partySize,
  currentTableIds,
  open,
  onOpenChange,
}: {
  reservationId: string | null;
  restaurantId: string | null;
  partySize: number;
  currentTableIds: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [tables, setTables] = useState<Table[]>([]);
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [tab, setTab] = useState<"single" | "combo">("single");

  useEffect(() => {
    if (!open || !restaurantId) return;
    setLoading(true);
    // Voorselectie: als reservering ≥2 tafels heeft, kies "combinatie"-tab; anders single
    if (currentTableIds.length >= 2) {
      setPicked(null);
      setTab("combo");
    } else {
      setPicked(currentTableIds[0] ? { kind: "single", tableId: currentTableIds[0] } : null);
      setTab("single");
    }
    (async () => {
      const [tRes, cRes] = await Promise.all([
        supabase.from("tables")
          .select("id, label, capacity_min, capacity_max, zones(name)")
          .eq("restaurant_id", restaurantId).eq("is_active", true).order("label"),
        supabase.from("table_combinations")
          .select("id, name, table_ids, capacity_min, capacity_max, is_active")
          .eq("restaurant_id", restaurantId).eq("is_active", true)
          .order("capacity_max", { ascending: true }),
      ]);
      setTables((tRes.data ?? []) as unknown as Table[]);
      setCombinations((cRes.data ?? []) as unknown as Combination[]);
      setLoading(false);
    })();
  }, [open, restaurantId, currentTableIds]);

  const tableById = useMemo(() => {
    const m = new Map<string, Table>();
    for (const t of tables) m.set(t.id, t);
    return m;
  }, [tables]);

  const assign = async () => {
    if (!reservationId || !picked) return;
    setBusy(true);
    const res = picked.kind === "single"
      ? await resService.update(reservationId, { table_id: picked.tableId, table_ids: undefined })
      : await resService.update(reservationId, { table_ids: picked.tableIds, combination_id: picked.combinationId });
    setBusy(false);
    if (!res.ok) return toast.error(res.error || "Toewijzen niet gelukt.");
    toast.success(picked.kind === "combo" ? "Combinatie toegewezen." : "Tafel toegewezen.");
    qc.invalidateQueries();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Tafel toewijzen</SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as "single" | "combo"); setPicked(null); }} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="single">Losse tafel</TabsTrigger>
            <TabsTrigger value="combo">Combinatie</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="flex-1 overflow-y-auto py-4 space-y-1.5 mt-0">
            {loading ? (
              <p className="text-sm text-muted-foreground">Laden…</p>
            ) : tables.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen tafels gevonden.</p>
            ) : tables.map((t) => {
              const fits = partySize >= t.capacity_min && partySize <= t.capacity_max;
              const active = picked?.kind === "single" && picked.tableId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setPicked({ kind: "single", tableId: t.id })}
                  className={cn(
                    "w-full text-left rounded-lg border p-3 transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t.label}</div>
                      {t.zones?.name && <div className="text-xs text-muted-foreground">{t.zones.name}</div>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.capacity_min}–{t.capacity_max} pers.
                      {!fits && <span className="ml-2 text-warning">past niet</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </TabsContent>

          <TabsContent value="combo" className="flex-1 overflow-y-auto py-4 space-y-1.5 mt-0">
            {loading ? (
              <p className="text-sm text-muted-foreground">Laden…</p>
            ) : combinations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen tafelcombinaties geconfigureerd.</p>
            ) : combinations.map((c) => {
              const fits = partySize >= c.capacity_min && partySize <= c.capacity_max;
              const active = picked?.kind === "combo" && picked.combinationId === c.id;
              const labels = (c.table_ids ?? [])
                .map((id) => tableById.get(id)?.label ?? "?")
                .join(" + ");
              return (
                <button
                  key={c.id}
                  onClick={() => setPicked({ kind: "combo", combinationId: c.id, tableIds: c.table_ids })}
                  className={cn(
                    "w-full text-left rounded-lg border p-3 transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{labels}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {c.capacity_min}–{c.capacity_max} pers.
                      {!fits && <span className="ml-2 text-warning">past niet</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </TabsContent>
        </Tabs>

        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={assign} disabled={busy || !picked}>{busy ? "Bezig…" : "Toewijzen"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
