// ReservationNoShowSection — drop-in section for the reservation detail dialog.
// Shows confirmation + reconfirmation status, no-show risk and deposit status,
// plus the operator quick actions.

import { useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { reservations as resService } from "@/services/reservations";
import { toast } from "sonner";
import { calculateNoShowSignal, RISK_LABEL } from "@/lib/noShowSignal";
import {
  ConfirmationStatusBadge, ReconfirmationStatusBadge,
  NoShowRiskBadge, DepositStatusBadge,
} from "@/components/no-show/NoShowBadges";
import { CheckCircle2, XCircle, Wallet, ShieldCheck, MailQuestion, Link as LinkIcon } from "lucide-react";

type Props = {
  // deno-lint-ignore no-explicit-any
  reservation: any;
  largeGroupThreshold?: number;
  depositDefaultAmountCents?: number;
  onChanged?: () => void;
};

export function ReservationNoShowSection({
  reservation: r, largeGroupThreshold, depositDefaultAmountCents, onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);

  const signal = calculateNoShowSignal({
    partySize: r.party_size,
    largeGroupThreshold,
    hasPhone: !!r.guests?.phone,
    hasEmail: !!r.guests?.email,
    guestVisitCount: r.guests?.visit_count ?? 0,
    guestNoShowCount: r.guests?.no_show_count ?? 0,
    reconfirmationStatus: r.reconfirmation_status,
    startTimeIso: r.start_time,
  });

  const isFinal = ["cancelled", "no_show", "completed"].includes(r.status);
  const reconfirmOpen = r.reconfirmation_status === "requested";

  const run = async (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return toast.error(res.error || "Niet opgeslagen.");
    toast.success(label);
    onChanged?.();
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">No-show preventie</div>
        {r.manage_token && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <LinkIcon className="h-3 w-3" /> Gastlink voorbereid
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <ConfirmationStatusBadge status={r.confirmation_status} />
        <ReconfirmationStatusBadge status={r.reconfirmation_status} />
        <NoShowRiskBadge level={signal.level} />
        <DepositStatusBadge status={r.deposit_status} amountCents={r.deposit_amount_cents} />
      </div>

      {signal.level !== "low" && (
        <div className="text-xs text-muted-foreground">
          {RISK_LABEL[signal.level]} · {signal.reasons.join(" · ")}
        </div>
      )}

      {r.reconfirmed_at && (
        <div className="text-xs text-muted-foreground">
          Gast bevestigde op {format(new Date(r.reconfirmed_at), "d MMM HH:mm", { locale: nl })}.
        </div>
      )}

      {!isFinal && (
        <div className="flex flex-wrap gap-2">
          {reconfirmOpen && (
            <>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run("Gast bevestigd", () => resService.markReconfirmed(r.id))}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Gast bevestigd
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run("Reservering geannuleerd — controleer wachtlijst",
                  () => resService.markReconfirmationDeclined(r.id))}>
                <XCircle className="h-4 w-4 mr-1.5" /> Kan niet komen
              </Button>
            </>
          )}
          {!reconfirmOpen && r.reconfirmation_status !== "confirmed" && (
            <Button size="sm" variant="ghost" disabled={busy}
              onClick={() => run("Herbevestiging voorbereid", () => resService.requestReconfirmation(r.id))}>
              <MailQuestion className="h-4 w-4 mr-1.5" /> Herbevestiging vragen
            </Button>
          )}
          {(!r.deposit_status || r.deposit_status === "not_required") && (
            <Button size="sm" variant="ghost" disabled={busy}
              onClick={() => run("Reserveringsgarantie aanbevolen",
                () => resService.setDepositStatus(r.id, "recommended", {
                  deposit_amount_cents: (depositDefaultAmountCents ?? 1000) * r.party_size,
                }))}>
              <Wallet className="h-4 w-4 mr-1.5" /> Garantie aanbevelen
            </Button>
          )}
          {["recommended", "required", "pending"].includes(r.deposit_status ?? "") && (
            <Button size="sm" variant="ghost" disabled={busy}
              onClick={() => run("Garantie vrijgesteld", () => resService.setDepositStatus(r.id, "waived"))}>
              <ShieldCheck className="h-4 w-4 mr-1.5" /> Garantie vrijstellen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
