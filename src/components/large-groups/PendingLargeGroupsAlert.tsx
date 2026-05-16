// PendingLargeGroupsAlert — prominente alert-tegel/banner voor
// grote-groep-aanvragen die nog handmatig beoordeeld moeten worden.
// Gebruikt op /app/vandaag (variant="card") en bovenaan /app/agenda (variant="banner").
import { Link } from "react-router-dom";
import { Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePendingLargeGroups } from "@/hooks/usePendingLargeGroups";

type Props = {
  variant?: "card" | "banner";
  className?: string;
};

export function PendingLargeGroupsAlert({ variant = "card", className }: Props) {
  const { count } = usePendingLargeGroups();
  if (count <= 0) return null;

  const label =
    count === 1
      ? "1 groepsaanvraag wacht op je beoordeling"
      : `${count} groepsaanvragen wachten op je beoordeling`;

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 border-b border-warning/30 bg-warning/10 text-sm",
          className,
        )}
      >
        <Users className="h-4 w-4 text-warning shrink-0" />
        <span className="text-foreground/90 flex-1 truncate">{label}</span>
        <Button asChild size="sm" variant="outline" className="h-8 shrink-0">
          <Link to="/app/reserveringen/grote-groepen">
            Bekijken <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-warning/40 bg-warning/10 p-4 flex items-center gap-3",
        className,
      )}
    >
      <div className="rounded-full bg-warning/20 p-2 shrink-0">
        <Users className="h-5 w-5 text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">
          Goedkeuren bevestigt de reservering, afwijzen annuleert hem.
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link to="/app/reserveringen/grote-groepen">
          Bekijken <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </Button>
    </div>
  );
}
