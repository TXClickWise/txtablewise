// Compacte feedbackhistorie voor gastprofiel — service-first, niet stigmatiserend.
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { getGuestReviewHistory, type ReviewRequest } from "@/services/reviews";
import { ReviewStatusBadge } from "@/components/reviews/ReviewStatusBadge";

export function GuestReviewHistory({ guestId }: { guestId: string }) {
  const [items, setItems] = useState<ReviewRequest[] | null>(null);

  useEffect(() => {
    let alive = true;
    getGuestReviewHistory(guestId).then((r) => alive && setItems(r)).catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [guestId]);

  if (items === null) return <p className="text-xs text-muted-foreground">Feedbackhistorie laden…</p>;
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">Nog geen feedback van deze gast ontvangen.</p>;
  }
  const latest = items.find((i) => i.satisfaction !== null);
  const openFollowUp = items.some((i) => i.manager_follow_up_required && i.follow_up_status !== "resolved");

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Feedbackhistorie helpt het team om gasten beter op te volgen.
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded bg-muted/40 p-2">
          <div className="text-muted-foreground">Laatste score</div>
          <div className="font-medium">{latest?.satisfaction ?? "—"}</div>
        </div>
        <div className="rounded bg-muted/40 p-2">
          <div className="text-muted-foreground">Open opvolging</div>
          <div className="font-medium">{openFollowUp ? "Ja" : "Nee"}</div>
        </div>
      </div>
      <ul className="space-y-1">
        {items.slice(0, 5).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-xs rounded border p-2">
            <span className="text-muted-foreground">
              {format(new Date(r.created_at), "d MMM yyyy", { locale: nl })}
              {r.satisfaction != null ? ` · ${r.satisfaction}/5` : ""}
            </span>
            <ReviewStatusBadge status={r.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
