// Sheet om een pre-order toe te voegen aan een reservering.
// Ondersteunt vaste items én vrije wens.
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { addPreOrder, formatPrice, listItems, type PreOrderItem } from "@/services/preOrders";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  reservationId: string;
  onAdded?: () => void;
};

export function AddPreOrderSheet({ open, onOpenChange, restaurantId, reservationId, onAdded }: Props) {
  const [items, setItems] = useState<PreOrderItem[]>([]);
  const [mode, setMode] = useState<"item" | "free">("item");
  const [itemId, setItemId] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !restaurantId) return;
    listItems(restaurantId).then(setItems).catch(() => setItems([]));
    setItemId("");
    setCustomName("");
    setQuantity(1);
    setNote("");
    setMode("item");
  }, [open, restaurantId]);

  const submit = async () => {
    setBusy(true);
    try {
      await addPreOrder({
        reservationId, restaurantId,
        itemId: mode === "item" ? itemId || null : null,
        customItemName: mode === "free" ? customName : null,
        quantity, note,
      });
      toast.success("Wens toegevoegd. Zichtbaar in Floor Mode.");
      onAdded?.();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deze pre-order kon niet worden opgeslagen. Probeer het opnieuw.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = quantity >= 1 && (mode === "item" ? !!itemId : customName.trim().length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Drankje of wens toevoegen</SheetTitle>
          <SheetDescription>Maak de ontvangst net wat persoonlijker. Voor MVP wordt dit nog niet afgerekend.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={mode === "item" ? "default" : "outline"} onClick={() => setMode("item")}>
              Uit lijst kiezen
            </Button>
            <Button variant={mode === "free" ? "default" : "outline"} onClick={() => setMode("free")}>
              Vrije wens
            </Button>
          </div>

          {mode === "item" ? (
            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger><SelectValue placeholder="Kies een drankje of extra…" /></SelectTrigger>
                <SelectContent>
                  {items.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Nog geen items. Voeg ze toe via Drankjes vooraf.
                    </div>
                  )}
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      <span className="flex items-center justify-between gap-3 w-full">
                        <span>{i.name}{i.category ? <span className="text-muted-foreground"> · {i.category}</span> : null}</span>
                        {formatPrice(i.price_cents) && <span className="text-muted-foreground">{formatPrice(i.price_cents)}</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Vrije wens</Label>
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Bv. Zet alvast een fles wit koud" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Aantal</Label>
              <Input type="number" min={1} value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notitie (optioneel)</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bv. met kaarsje, bij aankomst klaarzetten" />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 px-6 py-3 border-t bg-background flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={submit} disabled={!canSubmit || busy}>
            {busy ? "Opslaan…" : "Toevoegen"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
