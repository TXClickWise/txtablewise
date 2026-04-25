import { Badge } from "@/components/ui/badge";
import type { WaitlistStatus } from "@/services/waitlist";

const LABELS: Record<WaitlistStatus, string> = {
  waiting: "Wacht op plek",
  matched: "Match gevonden",
  notified: "Bericht voorbereid",
  confirmed: "Bevestigd",
  converted: "Omgezet",
  expired: "Verlopen",
  cancelled: "Geannuleerd",
};

const VARIANTS: Record<WaitlistStatus, string> = {
  waiting: "bg-muted text-muted-foreground border-border",
  matched: "bg-primary/10 text-primary border-primary/30",
  notified: "bg-warning/10 text-warning border-warning/30",
  confirmed: "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  converted: "bg-status-completed/10 text-status-completed border-status-completed/30",
  expired: "bg-status-noshow/10 text-status-noshow border-status-noshow/30",
  cancelled: "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
};

export function WaitlistStatusBadge({ status }: { status: WaitlistStatus }) {
  return (
    <Badge variant="outline" className={VARIANTS[status]}>
      {LABELS[status]}
    </Badge>
  );
}
