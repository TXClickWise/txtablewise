import { CalendarDays, CalendarRange, List, LayoutGrid, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReservationView = "day" | "week" | "list" | "grid" | "floor";

const ITEMS: Array<{ key: ReservationView; label: string; icon: typeof List }> = [
  { key: "day", label: "Dag", icon: CalendarDays },
  { key: "week", label: "Week", icon: CalendarRange },
  { key: "list", label: "Lijst", icon: List },
  { key: "grid", label: "Tafelgrid", icon: LayoutGrid },
  { key: "floor", label: "Floor", icon: Tablet },
];

export function ReservationViewSwitcher({
  value,
  onChange,
}: {
  value: ReservationView;
  onChange: (v: ReservationView) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5 overflow-x-auto">
      {ITEMS.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm whitespace-nowrap transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
            aria-pressed={active}
          >
            <it.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
