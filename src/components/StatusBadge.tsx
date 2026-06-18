import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-soft transition-smooth",
  {
    variants: {
      status: {
        hold: "bg-muted-foreground",
        pending: "bg-status-pending",
        confirmed: "bg-status-confirmed",
        seated: "bg-status-seated",
        completed: "bg-status-completed",
        cancelled: "bg-status-cancelled",
        no_show: "bg-status-noshow",
        request_received: "bg-status-pending",
        awaiting_approval: "bg-warning text-foreground",
        awaiting_deposit: "bg-warning text-foreground",
        approved: "bg-status-confirmed",
        declined: "bg-status-noshow",
      },
    },
    defaultVariants: { status: "pending" },
  }
);

const STATUS_LABELS: Record<string, string> = {
  hold: "Tijdelijk vast",
  pending: "Verwacht",
  confirmed: "Bevestigd",
  seated: "Aan tafel",
  completed: "Vertrokken",
  cancelled: "Geannuleerd",
  no_show: "No-show",
  request_received: "Aanvraag ontvangen",
  awaiting_approval: "Wacht op goedkeuring",
  awaiting_deposit: "Wacht op aanbetaling",
  approved: "Goedgekeurd",
  declined: "Afgewezen",
};

const PULSE_STATUSES = new Set(["seated", "no_show"]);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  label?: string;
}

export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  const key = status ?? "pending";
  const pulse = PULSE_STATUSES.has(key);
  return (
    <span className={cn(statusBadgeVariants({ status }), className)} {...props}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current",
          pulse && "status-dot-active"
        )}
      />
      {label ?? STATUS_LABELS[key] ?? key}
    </span>
  );
}
