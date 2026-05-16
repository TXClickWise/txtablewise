// ReservationQuickActionsPopover — kebab-knop ("⋯") die een popover opent
// met de ReservationStatusQuickBar + link "Open details". Gebruikt op
// tijdlijn-blokjes (Agenda → Tijdlijn) en plattegrond-tafelkaarten met
// een actieve reservering.
import { MoreHorizontal, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ReservationStatusQuickBar } from "./ReservationStatusQuickBar";
import { cn } from "@/lib/utils";

type Props = {
  reservationId: string;
  status: string;
  title: string;
  subtitle?: string;
  onOpenDetails?: () => void;
  /** Visuele knop-variant: standaard "floating" voor blokjes/tafelkaarten. */
  variant?: "floating" | "inline";
  className?: string;
};

export function ReservationQuickActionsPopover({
  reservationId, status, title, subtitle, onOpenDetails, variant = "floating", className,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            variant === "floating"
              ? "absolute top-0.5 right-0.5 z-[5] h-6 w-6 inline-flex items-center justify-center rounded bg-background/70 backdrop-blur-sm text-foreground/80 hover:bg-background hover:text-foreground shadow-sm"
              : "inline-flex items-center justify-center h-8 w-8 rounded hover:bg-muted text-muted-foreground hover:text-foreground",
            className,
          )}
          aria-label="Snelle acties voor deze reservering"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-3 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={status as never} />
          </div>
          <div className="font-medium text-sm truncate">{title}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
          )}
        </div>

        <div className="border-t border-border pt-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
            Status wijzigen
          </div>
          <ReservationStatusQuickBar
            reservationId={reservationId}
            status={status}
            size="md"
            layout="grid"
          />
        </div>

        {onOpenDetails && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={onOpenDetails}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open details
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
