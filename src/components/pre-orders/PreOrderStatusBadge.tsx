import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, PackageCheck, Soup, XCircle } from "lucide-react";
import type { PreOrderStatus } from "@/services/preOrders";
import { preOrderStatusLabel } from "@/services/preOrders";

const META: Record<PreOrderStatus, { tone: string; Icon: React.ComponentType<{ className?: string }> }> = {
  requested: { tone: "bg-muted text-muted-foreground border-border",                           Icon: Clock },
  confirmed: { tone: "bg-primary/10 text-primary border-primary/20",                            Icon: CheckCircle2 },
  prepared:  { tone: "bg-warning/10 text-warning border-warning/25",                            Icon: PackageCheck },
  served:    { tone: "bg-success/10 text-success border-success/25",                            Icon: Soup },
  cancelled: { tone: "bg-destructive/10 text-destructive border-destructive/25",               Icon: XCircle },
};

export function PreOrderStatusBadge({ status, className }: { status: PreOrderStatus; className?: string }) {
  const { tone, Icon } = META[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
      tone, className,
    )}>
      <Icon className="h-3 w-3" />
      {preOrderStatusLabel(status)}
    </span>
  );
}
