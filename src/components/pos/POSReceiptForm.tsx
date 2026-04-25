// Demo/handmatige POS-bon aanmaken voor een reservering. Geen live POS-call.
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDemoPOSReceipt, type PaymentStatus } from "@/services/pos";

type Props = {
  restaurantId: string;
  reservationId?: string | null;
  defaultCovers?: number;
  onCreated?: () => void;
};

export function POSReceiptForm({ restaurantId, reservationId, defaultCovers, onCreated }: Props) {
  const [amountEur, setAmountEur] = useState<string>("");
  const [covers, setCovers] = useState<number>(defaultCovers ?? 2);
  const [payment, setPayment] = useState<PaymentStatus>("paid");
  const [tip, setTip] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const amount = parseFloat(amountEur.replace(",", "."));
    if (!amount || amount <= 0) { toast.error("Vul een geldig bedrag in"); return; }
    setBusy(true);
    try {
      await createDemoPOSReceipt({
        restaurantId,
        reservationId: reservationId ?? null,
        totalCents: Math.round(amount * 100),
        tipCents: tip ? Math.round(parseFloat(tip.replace(",", ".")) * 100) : 0,
        guestCount: covers,
        paymentStatus: payment,
      });
      toast.success("Demo POS-bon aangemaakt", { description: "Gekoppeld als handmatige/demo data." });
      setAmountEur(""); setTip("");
      onCreated?.();
    } catch (e) {
      toast.error("Kon bon niet aanmaken", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Dit is demo-/handmatige POS-data. Er is nog geen live kassakoppeling actief.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Bedrag (€)</Label>
          <Input inputMode="decimal" placeholder="bv. 84,50" value={amountEur} onChange={(e) => setAmountEur(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Couverts</Label>
          <Input type="number" min={1} value={covers} onChange={(e) => setCovers(parseInt(e.target.value) || 1)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fooi (€, optioneel)</Label>
          <Input inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Betaalstatus</Label>
          <Select value={payment} onValueChange={(v) => setPayment(v as PaymentStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Betaald</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="refunded">Geretourneerd</SelectItem>
              <SelectItem value="cancelled">Geannuleerd</SelectItem>
              <SelectItem value="unknown">Onbekend</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={submit} disabled={busy} className="w-full">
        {busy ? "Bezig…" : "Demo POS-bon koppelen"}
      </Button>
    </div>
  );
}
