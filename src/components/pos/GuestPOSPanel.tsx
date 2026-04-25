// Service-eerste POS-overzicht in gastprofiel — geen waardeoordeel, alleen ondersteunend.
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listReceiptsForGuest, formatEuro, type POSReceipt } from "@/services/pos";

export function GuestPOSPanel({ restaurantId, guestId }: { restaurantId: string; guestId: string }) {
  const [receipts, setReceipts] = useState<POSReceipt[] | null>(null);
  useEffect(() => {
    listReceiptsForGuest(restaurantId, guestId).then(setReceipts).catch(() => setReceipts([]));
  }, [restaurantId, guestId]);

  if (receipts === null) return null;

  const total = receipts.reduce((s, r) => s + r.total_cents, 0);
  const visits = receipts.length;
  const avg = visits > 0 ? Math.round(total / visits) : 0;
  const last = receipts[0];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-display">Bezoekwaarde — POS-ready</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm space-y-2">
        <p className="text-xs text-muted-foreground">
          Omzetdata helpt later om bezoekwaarde te begrijpen, maar blijft ondersteunend aan gastvrijheid.
        </p>
        {visits === 0 ? (
          <p className="text-muted-foreground">Nog geen gekoppelde bonnen voor deze gast.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 rounded bg-muted/30 p-2 text-center">
            <div><div className="text-[10px] text-muted-foreground">Totaal (demo)</div><div className="font-display text-sm">{formatEuro(total)}</div></div>
            <div><div className="text-[10px] text-muted-foreground">Bezoeken met bon</div><div className="font-display text-sm">{visits}</div></div>
            <div><div className="text-[10px] text-muted-foreground">Gem. per bezoek</div><div className="font-display text-sm">{formatEuro(avg)}</div></div>
            <div className="col-span-3 text-[10px] text-muted-foreground">
              Laatste: {formatEuro(last.total_cents)} · {last.provider}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
