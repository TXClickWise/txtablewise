// Pre-order selection step for the public widget.
// Items come from `pre_order_items` (active only). No payment, no totals charged —
// selections are saved as wishes on the reservation via `pre_orders`.
import { useEffect, useState } from "react";
import { Sparkles, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getActivePreOrderItems, PreOrderItem, SelectedPreOrder } from "@/services/publicBooking";
import { PublicBookingNotice } from "./PublicBookingNotice";

export const PreOrderSelectionStep = ({
  restaurantId,
  allowFreeText,
  selected,
  onChange,
}: {
  restaurantId: string;
  allowFreeText: boolean;
  selected: SelectedPreOrder[];
  onChange: (next: SelectedPreOrder[]) => void;
}) => {
  const [items, setItems] = useState<PreOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [freeText, setFreeText] = useState(
    selected.find((s) => !s.item_id)?.note ?? "",
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    getActivePreOrderItems(restaurantId)
      .then((rows) => active && setItems(rows))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [restaurantId]);

  const qtyFor = (id: string) => selected.find((s) => s.item_id === id)?.quantity ?? 0;

  const setQty = (item: PreOrderItem, qty: number) => {
    const others = selected.filter((s) => s.item_id !== item.id);
    if (qty <= 0) return onChange(others);
    onChange([
      ...others,
      {
        item_id: item.id,
        item_name: item.name,
        unit_price_cents: item.price_cents ?? 0,
        quantity: qty,
      },
    ]);
  };

  const updateFreeText = (txt: string) => {
    setFreeText(txt);
    const others = selected.filter((s) => s.item_id);
    if (!txt.trim()) return onChange(others);
    onChange([
      ...others,
      { item_name: "Vrije wens", unit_price_cents: 0, quantity: 1, note: txt.trim().slice(0, 500) },
    ]);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0 && !allowFreeText) {
    return (
      <PublicBookingNotice>
        Er zijn momenteel geen extra's beschikbaar om vooraf klaar te laten zetten.
      </PublicBookingNotice>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-medium">Wil je iets laten klaarzetten bij aankomst?</span>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const qty = qtyFor(item.id);
            const active = qty > 0;
            return (
              <Card key={item.id} className={cn("transition-all", active && "border-primary shadow-sm")}>
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{item.description}</div>
                    )}
                    {typeof item.price_cents === "number" && item.price_cents > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        € {(item.price_cents / 100).toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {active ? (
                      <>
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9"
                          onClick={() => setQty(item, qty - 1)} aria-label="Minder">
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center font-medium tabular-nums">{qty}</span>
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9"
                          onClick={() => setQty(item, qty + 1)} aria-label="Meer">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button type="button" variant="outline" size="sm" className="h-9"
                        onClick={() => setQty(item, 1)}>
                        Toevoegen
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {allowFreeText && (
        <div className="space-y-1.5 pt-2">
          <Label>Andere wens</Label>
          <Input value={freeText} onChange={(e) => updateFreeText(e.target.value)}
            placeholder="Bijv. fles cava op tafel, kinderstoel klaarzetten" className="h-12" />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Voor nu wordt dit als wens bij je reservering opgeslagen. Betaling gebeurt nog niet online.
      </p>
    </div>
  );
};
