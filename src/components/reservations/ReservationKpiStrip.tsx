import { Users, AlertTriangle, ShieldAlert, Armchair } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Kpi = {
  key: string;
  label: string;
  value: number | string;
  icon: typeof Users;
  tone?: "default" | "warning" | "danger" | "success";
  active?: boolean;
  onClick?: () => void;
};

const TONE: Record<NonNullable<Kpi["tone"]>, string> = {
  default: "text-foreground",
  warning: "text-warning",
  danger: "text-destructive",
  success: "text-success",
};

export function ReservationKpiStrip({
  guestsToday,
  needsAttention,
  freeTablesNow,
  noShowRiskCount,
  activeKey,
  onSelect,
}: {
  guestsToday: number;
  needsAttention: number;
  freeTablesNow: number;
  noShowRiskCount: number;
  activeKey?: string | null;
  onSelect?: (key: "attention" | "risk" | null) => void;
}) {
  const kpis: Kpi[] = [
    { key: "guests", label: "Gasten vandaag", value: guestsToday, icon: Users },
    {
      key: "attention",
      label: "Aandacht nodig",
      value: needsAttention,
      icon: AlertTriangle,
      tone: needsAttention > 0 ? "warning" : "default",
      active: activeKey === "attention",
      onClick: () => onSelect?.(activeKey === "attention" ? null : "attention"),
    },
    { key: "free", label: "Tafels vrij nu", value: freeTablesNow, icon: Armchair, tone: "success" },
    {
      key: "risk",
      label: "No-show risico",
      value: noShowRiskCount,
      icon: ShieldAlert,
      tone: noShowRiskCount > 0 ? "danger" : "default",
      active: activeKey === "risk",
      onClick: () => onSelect?.(activeKey === "risk" ? null : "risk"),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {kpis.map((k) => {
        const clickable = !!k.onClick;
        const Comp: any = clickable ? "button" : "div";
        return (
          <Comp
            key={k.key}
            onClick={k.onClick}
            className={cn(
              "text-left rounded-lg border bg-card transition-colors",
              clickable && "hover:border-primary/50 cursor-pointer",
              k.active && "border-primary ring-1 ring-primary/30",
              !k.active && "border-border",
            )}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <k.icon className="h-3.5 w-3.5" />
                {k.label}
              </div>
              <div className={cn("font-display text-2xl sm:text-3xl mt-1", TONE[k.tone ?? "default"])}>
                {k.value}
              </div>
            </CardContent>
          </Comp>
        );
      })}
    </div>
  );
}

export { Card };
