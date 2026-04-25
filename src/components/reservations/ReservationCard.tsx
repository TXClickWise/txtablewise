// ReservationCard — scannable, touch-friendly card used across overview,
// today, and search results. Quick actions go through the reservations service.
import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, UserCheck, XCircle, AlertOctagon, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelBadge } from "@/components/ChannelBadge";
import { ReservationBadges, type ReservationFlags } from "./ReservationBadges";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { reservations as resService } from "@/services/reservations";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// Loose shape — matches what the page selects. Keep flexible so callers don't
// have to fight types when they include slightly different joins.
export type CardReservation = {
  id: string;
  start_time: string;
  end_time?: string;
  party_size: number;
  status: string;
  channel: string;
  special_requests: string | null;
  internal_notes?: string | null;
  occasion?: string | null;
  dietary_notes?: string | null;
  confirmation_code?: string | null;
  requires_manual_approval?: boolean;
  large_group_status?: string | null;
  reminder_confirmed_at?: string | null;
  guests?: {
    first_name?: string | null; last_name?: string | null;
    phone?: string | null; email?: string | null;
    is_vip?: boolean | null; allergies?: string | null;
  } | null;
  reservation_tables?: Array<{ tables?: { label?: string } | null }> | null;
  pre_orders?: Array<{ id: string }> | null;
};

type Props = {
  reservation: CardReservation;
  onOpen: (id: string) => void;
  largeGroupThreshold?: number;
  invalidateKeys?: string[];
  /** Hide secondary actions on small layouts. */
  compact?: boolean;
};

type ConfirmKind = null | "cancel" | "no_show";

export function ReservationCard({
  reservation, onOpen, largeGroupThreshold, invalidateKeys = [], compact,
}: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);

  const r = reservation;
  const guest = r.guests;
  const tableLabel = r.reservation_tables?.map((rt) => rt?.tables?.label).filter(Boolean).join(", ");
  const isWalkIn = r.channel === "walk_in";

  const flags: ReservationFlags = {
    partySize: r.party_size,
    isWalkIn,
    isVip: !!guest?.is_vip,
    hasAllergy: !!(guest?.allergies || r.dietary_notes),
    hasPreOrder: (r.pre_orders?.length ?? 0) > 0,
    occasion: r.occasion,
    largeGroupThreshold,
    requiresManualApproval: r.requires_manual_approval,
    largeGroupStatus: r.large_group_status,
    reminderConfirmed: !!r.reminder_confirmed_at,
    startTimeIso: r.start_time,
    status: r.status,
  };

  const refresh = () => {
    qc.invalidateQueries();
    invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const run = async (kind: "seated" | "completed" | "cancel" | "no_show") => {
    setBusy(true);
    let res;
    switch (kind) {
      case "seated":    res = await resService.markSeated(r.id); break;
      case "completed": res = await resService.markCompleted(r.id); break;
      case "cancel":    res = await resService.cancel(r.id); break;
      case "no_show":   res = await resService.markNoShow(r.id); break;
    }
    setBusy(false);
    if (!res.ok) return toast.error(res.error || "Actie mislukt.");
    const messages: Record<string, string> = {
      seated:    "Gast staat op 'aangekomen'.",
      completed: "Bezoek afgerond.",
      cancel:    "De reservering is geannuleerd. De tafel komt weer beschikbaar.",
      no_show:   "Gemarkeerd als no-show.",
    };
    toast.success(messages[kind]);
    refresh();
  };

  const status = r.status;
  const canSeat = status === "confirmed" || status === "pending";
  const canComplete = status === "seated";
  const canNoShow = status === "confirmed" || status === "pending";
  const canCancel = ["pending", "confirmed", "seated", "hold"].includes(status);

  return (
    <>
      <div
        className={cn(
          "group rounded-lg border border-border bg-card transition-colors",
          status === "cancelled" || status === "no_show" ? "opacity-70" : "",
        )}
      >
        <div className="p-3 sm:p-4 flex items-start gap-3 sm:gap-4 flex-wrap">
          {/* Time / size */}
          <button
            type="button"
            onClick={() => onOpen(r.id)}
            className="text-center min-w-[64px] py-1 -m-1 rounded-md hover:bg-muted/40"
          >
            <div className="font-display text-xl leading-none">
              {format(new Date(r.start_time), "HH:mm")}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{r.party_size}p</div>
          </button>

          {/* Body */}
          <button
            type="button"
            onClick={() => onOpen(r.id)}
            className="flex-1 min-w-0 text-left"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">
                {guest?.first_name ?? (isWalkIn ? "Walk-in" : "Gast")}{" "}
                {guest?.last_name ?? ""}
              </span>
              <StatusBadge status={status as never} />
              <ChannelBadge channel={r.channel as never} />
            </div>

            <div className="text-sm text-muted-foreground mt-0.5 truncate">
              {tableLabel ? <span>Tafel {tableLabel}</span> : <span>Geen tafel toegewezen</span>}
              {guest?.phone && <span> · {guest.phone}</span>}
              {guest?.email && !guest?.phone && <span> · {guest.email}</span>}
            </div>

            {(r.special_requests || guest?.allergies) && (
              <div className="text-xs mt-1 text-muted-foreground italic line-clamp-1">
                {guest?.allergies ? `Allergie: ${guest.allergies}. ` : ""}
                {r.special_requests}
              </div>
            )}

            <div className="mt-2">
              <ReservationBadges flags={flags} max={compact ? 3 : 6} />
            </div>
          </button>

          {/* Quick actions */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <Button
              size="sm" variant="ghost" className="h-9 w-9 p-0"
              aria-label="Bekijken"
              onClick={() => onOpen(r.id)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {canSeat && (
              <Button size="sm" className="h-9 gap-1.5" disabled={busy} onClick={() => run("seated")}>
                <UserCheck className="h-4 w-4" /> <span className="hidden sm:inline">Aangekomen</span>
              </Button>
            )}
            {canComplete && (
              <Button size="sm" variant="secondary" className="h-9 gap-1.5" disabled={busy} onClick={() => run("completed")}>
                <CheckCircle2 className="h-4 w-4" /> <span className="hidden sm:inline">Voltooid</span>
              </Button>
            )}
            {!compact && canNoShow && (
              <Button
                size="sm" variant="outline"
                className="h-9 gap-1.5" disabled={busy}
                onClick={() => setConfirm("no_show")}
              >
                <AlertOctagon className="h-4 w-4" /> <span className="hidden md:inline">No-show</span>
              </Button>
            )}
            {!compact && canCancel && (
              <Button
                size="sm" variant="ghost"
                className="h-9 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={busy}
                onClick={() => setConfirm("cancel")}
              >
                <XCircle className="h-4 w-4" /> <span className="hidden md:inline">Annuleer</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "cancel" ? "Reservering annuleren?" : "Markeer als no-show?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "cancel"
                ? "De tafel komt weer beschikbaar. Deze actie kan niet ongedaan gemaakt worden."
                : "Dit wordt opgeslagen in de gastgeschiedenis en helpt later bij no-show preventie."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Terug</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirm) run(confirm); setConfirm(null); }}>
              {confirm === "cancel" ? "Ja, annuleren" : "Ja, markeren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
