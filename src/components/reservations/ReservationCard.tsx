// ReservationCard — scannable, touch-friendly card used across overview,
// today, and search results. Quick actions go through the reservations service.
import { format } from "date-fns";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelBadge } from "@/components/ChannelBadge";
import { ReservationBadges, type ReservationFlags } from "./ReservationBadges";
import { ReservationStatusQuickBar } from "./ReservationStatusQuickBar";
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
  /** Optional slot for additional row actions (kebab menu, etc.). */
  extraActions?: React.ReactNode;
};

export function ReservationCard({
  reservation, onOpen, largeGroupThreshold, invalidateKeys: _ignored, compact, extraActions,
}: Props) {
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

  const status = r.status;

  return (
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
          <ReservationStatusQuickBar
            reservationId={r.id}
            status={status}
            size="sm"
            hideDestructive={compact}
          />
          {extraActions}
        </div>
      </div>
    </div>
  );
}
