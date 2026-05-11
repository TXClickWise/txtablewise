// Sectie binnen reserveringsdetail: alle drankjes & extra's voor deze reservering.
import { useEffect, useState } from "react";
import { Plus, Beer, Trash2, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  changeStatus, listForReservation, cancelPreOrder, formatPrice,
  getHospitalitySuggestions, type ReservationPreOrder,
} from "@/services/preOrders";
import { pushPreorderToLoyverse } from "@/services/pos";
import { PreOrderStatusBadge } from "./PreOrderStatusBadge";
import { AddPreOrderSheet } from "./AddPreOrderSheet";

type Props = {
  reservationId: string;
  restaurantId: string;
  partySize: number;
  occasion?: string | null;
  largeGroupThreshold?: number;
  isVip?: boolean;
};

export function ReservationPreOrderSection({
  reservationId, restaurantId, partySize, occasion, largeGroupThreshold, isVip,
}: Props) {
  const [items, setItems] = useState<ReservationPreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try { setItems(await listForReservation(reservationId)); } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [reservationId]);

  const setStatus = async (id: string, next: "confirmed" | "prepared" | "served") => {
    setBusyId(id);
    try { await changeStatus(restaurantId, id, next); await refresh(); }
    catch { toast.error("Status kon niet worden bijgewerkt."); }
    finally { setBusyId(null); }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try { await cancelPreOrder(restaurantId, id); await refresh(); toast.success("Wens geannuleerd."); }
    catch { toast.error("Kon niet annuleren."); }
    finally { setBusyId(null); }
  };

  const suggestions = getHospitalitySuggestions({
    partySize, occasion, largeGroupThreshold, isVip,
  }).filter((s) => !items.some((i) => i.item_name.toLowerCase() === s.itemName.toLowerCase()));

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Beer className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Drankjes & extra's</span>
        </div>
        <Button size="sm" variant="outline" className="h-8" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Toevoegen
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Laden…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Geen drankjes of extra's vooraf ingesteld.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((po) => (
            <li key={po.id} className="rounded-md bg-muted/40 p-2.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {po.quantity}× {po.item_name}
                    {po.unit_price_cents > 0 && (
                      <span className="text-muted-foreground font-normal"> · {formatPrice(po.unit_price_cents)}</span>
                    )}
                  </div>
                  {po.note && <div className="text-xs text-muted-foreground mt-0.5">{po.note}</div>}
                </div>
                <PreOrderStatusBadge status={po.status} />
              </div>
              {po.status !== "cancelled" && po.status !== "served" && (
                <div className="flex flex-wrap gap-1.5">
                  {po.status === "requested" && (
                    <Button size="sm" variant="secondary" className="h-7 text-xs"
                      disabled={busyId === po.id} onClick={() => setStatus(po.id, "confirmed")}>
                      Bevestigd
                    </Button>
                  )}
                  {(po.status === "requested" || po.status === "confirmed") && (
                    <Button size="sm" variant="secondary" className="h-7 text-xs"
                      disabled={busyId === po.id} onClick={() => setStatus(po.id, "prepared")}>
                      Klaar
                    </Button>
                  )}
                  {po.status === "prepared" && (
                    <Button size="sm" className="h-7 text-xs"
                      disabled={busyId === po.id} onClick={() => setStatus(po.id, "served")}>
                      Geserveerd
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                    disabled={busyId === po.id} onClick={() => remove(po.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Annuleren
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 && (
        <div className="pt-2 border-t space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Hospitality-suggesties</div>
          {suggestions.slice(0, 3).map((s, idx) => (
            <div key={idx} className="text-xs flex items-start justify-between gap-2 rounded bg-muted/30 px-2 py-1.5">
              <div className="min-w-0">
                <div className="font-medium truncate">{s.itemName}</div>
                <div className="text-muted-foreground">{s.reason}</div>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Suggesties worden niet automatisch toegevoegd.</p>
        </div>
      )}

      <AddPreOrderSheet
        open={addOpen} onOpenChange={setAddOpen}
        restaurantId={restaurantId} reservationId={reservationId}
        onAdded={refresh}
      />
    </div>
  );
}
