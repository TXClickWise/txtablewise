// POS-sectie binnen reserveringsdetail — toont gekoppelde bonnen en demo-actie.
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, Plus, Unlink } from "lucide-react";
import { listReceiptsForReservation, unmatchReceipt, formatEuro, type POSReceipt } from "@/services/pos";
import { POSReceiptForm } from "./POSReceiptForm";
import { toast } from "sonner";

export function ReservationPOSSection({ restaurantId, reservationId, partySize }: { restaurantId: string; reservationId: string; partySize?: number }) {
  const [receipts, setReceipts] = useState<POSReceipt[]>([]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setReceipts(await listReceiptsForReservation(reservationId)); } finally { setLoading(false); }
  }, [reservationId]);

  useEffect(() => { load(); }, [load]);

  async function unlink(r: POSReceipt) {
    try { await unmatchReceipt(r); toast.success("Bon ontkoppeld"); load(); }
    catch (e) { toast.error("Kon niet ontkoppelen", { description: (e as Error).message }); }
  }

  const total = receipts.reduce((s, r) => s + r.total_cents, 0);
  const covers = receipts.reduce((s, r) => s + (r.guest_count ?? 0), 0);
  const perCover = covers > 0 ? Math.round(total / covers) : 0;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <Receipt className="h-4 w-4" /> POS / Omzet
          <Badge variant="outline" className="text-[10px]">Demo</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Demo-bon
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-3 text-sm">
        {adding && (
          <div className="rounded border bg-muted/30 p-3">
            <POSReceiptForm restaurantId={restaurantId} reservationId={reservationId} defaultCovers={partySize} onCreated={() => { setAdding(false); load(); }} />
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-xs">Laden…</p>
        ) : receipts.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nog geen POS-bon gekoppeld. POS-data is demo/handmatig totdat een live kassakoppeling actief is.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 rounded bg-muted/30 p-2 text-center">
              <div><div className="text-xs text-muted-foreground">Totaal</div><div className="font-display text-base">{formatEuro(total)}</div></div>
              <div><div className="text-xs text-muted-foreground">Couverts</div><div className="font-display text-base">{covers || "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">Per couvert</div><div className="font-display text-base">{perCover ? formatEuro(perCover) : "—"}</div></div>
            </div>
            <ul className="space-y-1.5">
              {receipts.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded border px-2 py-1.5">
                  <div className="space-y-0.5">
                    <div className="text-sm">{formatEuro(r.total_cents)} <span className="text-muted-foreground text-xs">· {r.guest_count ?? "?"} couverts · {r.payment_status}</span></div>
                    <div className="text-[10px] text-muted-foreground">{r.provider} · {r.matching_status}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => unlink(r)} title="Ontkoppel">
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
