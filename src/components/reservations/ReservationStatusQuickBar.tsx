// ReservationStatusQuickBar — single component voor snelle statusovergangen.
// Gebruik overal: ReservationCard, detail-sheet, detail-dialog, agenda popovers.
// Eén tap voor positieve overgangen (Aan tafel, Afgerond); bevestiging voor
// destructieve acties (No-show, Annuleren, Heropenen).
import { useState } from "react";
import { CheckCircle2, UserCheck, XCircle, AlertOctagon, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionDialog } from "@/components/touch/ConfirmActionDialog";
import { reservations as resService, type ReservationStatus } from "@/services/reservations";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

interface Props {
  reservationId: string;
  status: string;
  size?: Size;
  /** Layout: row (inline buttons) or grid (2 cols for tablet/floor mode). */
  layout?: "row" | "grid";
  /** Hide cancel/no-show (gebruik in cards die al een kebab hebben). */
  hideDestructive?: boolean;
  /** Compact = alleen primaire knop. */
  primaryOnly?: boolean;
  className?: string;
  onChanged?: () => void;
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 text-xs",
  md: "h-10 text-sm",
  lg: "h-14 text-base",
};

export function ReservationStatusQuickBar({
  reservationId, status, size = "sm", layout = "row",
  hideDestructive, primaryOnly, className, onChanged,
}: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"cancel" | "no_show" | "reopen" | null>(null);

  const refresh = () => {
    qc.invalidateQueries();
    onChanged?.();
  };

  const run = async (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMsg: string,
  ) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return toast.error(res.error || "Actie mislukt.");
    toast.success(successMsg);
    refresh();
  };

  const isEnd = ["completed", "cancelled", "no_show"].includes(status);
  const canSeat = status === "confirmed" || status === "pending";
  const canComplete = status === "seated" || status === "finished";
  const canConfirm = status === "pending";
  const canNoShow = status === "confirmed" || status === "pending";
  const canCancel = ["pending", "confirmed", "seated", "hold"].includes(status);

  // End-state: alleen badge + heropenen
  if (isEnd) {
    return (
      <>
        <div className={cn("flex items-center gap-2 flex-wrap", className)}>
          <StatusBadge status={status as never} />
          {!hideDestructive && (
            <Button
              size="sm" variant="ghost" className={SIZE_CLASSES[size]}
              disabled={busy}
              onClick={() => setConfirm("reopen")}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Heropenen
            </Button>
          )}
        </div>
        <ConfirmActionDialog
          open={confirm === "reopen"}
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Reservering heropenen?"
          description="De reservering komt terug op status 'Bevestigd'."
          confirmLabel="Ja, heropen"
          onConfirm={async () => {
            await run(
              () => resService.changeStatus(reservationId, "confirmed"),
              "Reservering heropend.",
            );
            setConfirm(null);
          }}
        />
      </>
    );
  }

  const sizeClass = SIZE_CLASSES[size];
  const containerClass = cn(
    layout === "grid" ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-1.5 items-center",
    className,
  );

  return (
    <>
      <div className={containerClass}>
        {canConfirm && (
          <Button
            size="sm" className={cn(sizeClass, "gap-1.5")}
            disabled={busy} onClick={() =>
              run(() => resService.changeStatus(reservationId, "confirmed"), "Reservering bevestigd.")}
          >
            <ShieldCheck className="h-4 w-4" /> Bevestig
          </Button>
        )}
        {canSeat && (
          <Button
            size="sm" className={cn(sizeClass, "gap-1.5")}
            disabled={busy} onClick={() =>
              run(() => resService.markSeated(reservationId), "Gast staat op 'aangekomen'.")}
          >
            <UserCheck className="h-4 w-4" /> Aan tafel
          </Button>
        )}
        {canComplete && (
          <Button
            size="sm" variant="secondary" className={cn(sizeClass, "gap-1.5")}
            disabled={busy} onClick={() =>
              run(() => resService.markCompleted(reservationId), "Bezoek afgerond.")}
          >
            <CheckCircle2 className="h-4 w-4" /> Afgerond
          </Button>
        )}

        {!primaryOnly && !hideDestructive && canNoShow && (
          <Button
            size="sm" variant="outline" className={cn(sizeClass, "gap-1.5")}
            disabled={busy} onClick={() => setConfirm("no_show")}
          >
            <AlertOctagon className="h-4 w-4" /> No-show
          </Button>
        )}
        {!primaryOnly && !hideDestructive && canCancel && (
          <Button
            size="sm" variant="ghost"
            className={cn(sizeClass, "gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10")}
            disabled={busy} onClick={() => setConfirm("cancel")}
          >
            <XCircle className="h-4 w-4" /> Annuleer
          </Button>
        )}
      </div>

      <ConfirmActionDialog
        open={confirm === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Reservering annuleren?"
        description="De tafel komt weer beschikbaar. Deze actie kan niet ongedaan gemaakt worden."
        confirmLabel="Ja, annuleren"
        destructive
        onConfirm={async () => {
          await run(() => resService.cancel(reservationId), "De reservering is geannuleerd.");
          setConfirm(null);
        }}
      />
      <ConfirmActionDialog
        open={confirm === "no_show"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Markeer als no-show?"
        description="Dit wordt opgeslagen in de gastgeschiedenis en helpt later bij no-show preventie."
        confirmLabel="Ja, markeren"
        onConfirm={async () => {
          await run(() => resService.markNoShow(reservationId), "Gemarkeerd als no-show.");
          setConfirm(null);
        }}
      />
    </>
  );
}
