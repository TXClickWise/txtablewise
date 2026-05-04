import { cn } from "@/lib/utils";
import { Check, Circle, AlertTriangle, Clock3, MinusCircle } from "lucide-react";

export type StepStatus = "not_started" | "in_progress" | "done" | "attention" | "skipped";

const META: Record<
  StepStatus,
  { label: string; className: string; Icon: typeof Check }
> = {
  not_started: {
    label: "Niet gestart",
    className: "bg-muted text-muted-foreground border-border",
    Icon: Circle,
  },
  in_progress: {
    label: "Bezig",
    className:
      "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
    Icon: Clock3,
  },
  done: {
    label: "Voltooid",
    className:
      "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
    Icon: Check,
  },
  attention: {
    label: "Aandacht nodig",
    className:
      "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300",
    Icon: AlertTriangle,
  },
  skipped: {
    label: "Overgeslagen",
    className: "bg-muted text-muted-foreground border-border",
    Icon: MinusCircle,
  },
};

export const StepStatusBadge = ({
  status,
  size = "sm",
  className,
}: {
  status: StepStatus;
  size?: "sm" | "md";
  className?: string;
}) => {
  const m = META[status];
  const Icon = m.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        m.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
};

export const StepStatusDot = ({ status }: { status: StepStatus }) => {
  const colors: Record<StepStatus, string> = {
    not_started: "bg-muted-foreground/30",
    in_progress: "bg-amber-500",
    done: "bg-emerald-500",
    attention: "bg-red-500",
  };
  return <span className={cn("h-2 w-2 rounded-full shrink-0", colors[status])} />;
};
