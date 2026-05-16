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
import { usePreordersEnabled } from "@/hooks/usePreordersEnabled";

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
  const [pushStatus, setPushStatus] = useState<{ pushed_at: string | null; status: string | null; receipt_id: string | null }>({ pushed_at: null, status: null, receipt_id: null });
  const [pushing, setPushing] = useState(false);
  const { enabled: moduleEnabled } = usePreordersEnabled(restaurantId);

  const refreshPushStatus = async () => {
    const { data } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { maybeSingle: () => Promise<{ data: { pos_preorder_pushed_at: string | null; pos_preorder_status: string | null; pos_preorder_receipt_id: string | null } | null }> } } } })
      .from("reservations").select("pos_preorder_pushed_at,pos_preorder_status,pos_preorder_receipt_id").eq("id", reservationId).maybeSingle();
    setPushStatus({
      pushed_at: data?.pos_preorder_pushed_at ?? null,
      status: data?.pos_preorder_status ?? null,
      receipt_id: data?.pos_preorder_receipt_id ?? null,
    });
  };

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await listForReservation(reservationId));
      await refreshPushStatus();
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [reservationId]);

  const handlePush = async () => {
    setPushing(true);
    try {
      const r = await pushPreorderToLoyverse(reservationId);
      if (r.ok) {
        toast.success("Bon klaargezet in Loyverse", { description: r.receipt_id ? `Bonnr ${r.receipt_id}` : undefined });
      } else if (r.skipped) {
        const map: Record<string, string> = {
          already_pushed: "Bon is al eerder gepusht.",
          not_connected: "Loyverse is niet gekoppeld.",
          push_disabled: "Automatisch pushen staat uit — schakel het in op de POS-pagina.",
          no_preorders: "Geen pre-order items op deze reservering.",
          no_loyverse_mapped_items: "Geen items zijn aan een Loyverse-product gekoppeld.",
          status_blocks_push: "Reservering is geannuleerd of afgerond.",
        };
        toast.message("Niet gepusht", { description: map[r.skipped] ?? r.skipped });
      } else {
        toast.error("Pushen mislukt", { description: r.error });
      }
      await refreshPushStatus();
    } catch (e) {
      toast.error("Pushen mislukt", { description: (e as Error).message });
    } finally {
      setPushing(false);
    }
  };

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

  if (!moduleEnabled && items.length === 0 && !loading) return null;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Beer className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Drankjes & extra's</span>
          {pushStatus.status === "pushed" && (
            <Badge variant="outline" className="gap-1 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3" /> Bon klaargezet in Loyverse
            </Badge>
          )}
          {pushStatus.status === "failed" && (
            <Badge variant="outline" className="gap-1 text-[10px] bg-destructive/10 text-destructive border-destructive/30">
              <AlertCircle className="h-3 w-3" /> Loyverse-push mislukt
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && pushStatus.status !== "pushed" && (
            <Button size="sm" variant="outline" className="h-8" disabled={pushing} onClick={handlePush}>
              {pushing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Nu naar Loyverse
            </Button>
          )}
          {moduleEnabled && (
            <Button size="sm" variant="outline" className="h-8" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Toevoegen
            </Button>
          )}
        </div>
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
