import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-smooth",
  {
    variants: {
      status: {
        hold: "bg-muted text-muted-foreground border-border",
        pending: "bg-status-pending/10 text-status-pending border-status-pending/30",
        confirmed: "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
        seated: "bg-status-seated/10 text-status-seated border-status-seated/30",
        finished: "bg-status-completed/10 text-status-completed border-status-completed/30",
        completed: "bg-status-completed/10 text-status-completed border-status-completed/30",
        cancelled: "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
        no_show: "bg-status-noshow/10 text-status-noshow border-status-noshow/30",
        request_received: "bg-status-pending/10 text-status-pending border-status-pending/30",
        awaiting_approval: "bg-warning/10 text-warning border-warning/30",
        awaiting_deposit: "bg-warning/10 text-warning border-warning/30",
        approved: "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
        declined: "bg-status-noshow/10 text-status-noshow border-status-noshow/30",
      },
    },
    defaultVariants: { status: "pending" },
  }
);

const STATUS_LABELS: Record<string, string> = {
  hold: "Tijdelijk vast",
  pending: "In afwachting",
  confirmed: "Bevestigd",
  seated: "Aan tafel",
  finished: "Afgerekend",
  completed: "Voltooid",
  cancelled: "Geannuleerd",
  no_show: "No-show",
  request_received: "Aanvraag ontvangen",
  awaiting_approval: "Wacht op goedkeuring",
  awaiting_deposit: "Wacht op aanbetaling",
  approved: "Goedgekeurd",
  declined: "Afgewezen",
};

const STATUS_DOTS: Record<string, string> = {
  hold: "bg-muted-foreground",
  pending: "bg-status-pending",
  confirmed: "bg-status-confirmed",
  seated: "bg-status-seated",
  finished: "bg-status-completed",
  completed: "bg-status-completed",
  cancelled: "bg-status-cancelled",
  no_show: "bg-status-noshow",
  request_received: "bg-status-pending",
  awaiting_approval: "bg-warning",
  awaiting_deposit: "bg-warning",
  approved: "bg-status-confirmed",
  declined: "bg-status-noshow",
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  label?: string;
}

export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  const key = status ?? "pending";
  return (
    <span className={cn(statusBadgeVariants({ status }), className)} {...props}>
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[key])} />
      {label ?? STATUS_LABELS[key] ?? key}
    </span>
  );
}
