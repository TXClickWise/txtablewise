import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/lib/plans";

interface Props {
  plan: SubscriptionPlan;
  className?: string;
  compact?: boolean;
}

const LABEL: Record<SubscriptionPlan, string> = {
  trial: "Trial",
  basic: "Basic",
  pro: "Pro",
};

export function UpgradeBadge({ plan, className, compact }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-primary/30 bg-primary/5 text-primary text-[10px] font-medium uppercase tracking-wide",
        compact ? "px-1.5 py-0 h-4" : "",
        className,
      )}
    >
      {!compact && <Sparkles className="h-3 w-3" />}
      {LABEL[plan]}
    </Badge>
  );
}
