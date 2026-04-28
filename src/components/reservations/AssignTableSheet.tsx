import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { reservations as resService } from "@/services/reservations";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Table = { id: string; label: string; capacity_min: number; capacity_max: number; zones?: { name?: string } | null };

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
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !restaurantId) return;
    setLoading(true);
    setPicked(currentTableIds[0] ?? null);
    (async () => {
      const { data } = await supabase.from("tables")
        .select("id, label, capacity_min, capacity_max, zones(name)")
        .eq("restaurant_id", restaurantId).eq("is_active", true).order("label");
      setTables((data ?? []) as unknown as Table[]);
      setLoading(false);
    })();
  }, [open, restaurantId, currentTableIds]);

  const assign = async () => {
    if (!reservationId || !picked) return;
    setBusy(true);
    const res = await resService.update(reservationId, { table_id: picked });
    setBusy(false);
    if (!res.ok) return toast.error(res.error || "Toewijzen niet gelukt.");
    toast.success("Tafel toegewezen.");
    qc.invalidateQueries();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Tafel toewijzen</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-1.5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : tables.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen tafels gevonden.</p>
          ) : tables.map((t) => {
            const fits = partySize >= t.capacity_min && partySize <= t.capacity_max;
            const active = picked === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setPicked(t.id)}
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
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={assign} disabled={busy || !picked}>{busy ? "Bezig…" : "Toewijzen"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
