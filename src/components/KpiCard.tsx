import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiDelta {
  value: string;
  trend: "up" | "down" | "flat";
  /** Soms is "omhoog" slecht (bv. no-shows). Default: up = goed. */
  invert?: boolean;
}

type AccentColor = "default" | "primary" | "success" | "warning" | "destructive" | "info";

interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: AccentColor;
  delta?: KpiDelta;
  tone?: "neutral" | "premium";
  /** Toont een 3px gekleurde top-border per metric (DEEL 8 — Vandaag) */
  statusAccent?: AccentColor;
}

const ACCENT: Record<AccentColor, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
};

const STATUS_ACCENT_BORDER: Record<AccentColor, string> = {
  default: "border-t-border",
  primary: "border-t-primary",
  success: "border-t-success",
  warning: "border-t-warning",
  destructive: "border-t-destructive",
  info: "border-t-info",
};

function deltaTone(delta: KpiDelta) {
  if (delta.trend === "flat") return "bg-muted text-muted-foreground border-border";
  const positive =
    (delta.trend === "up" && !delta.invert) ||
    (delta.trend === "down" && delta.invert);
  return positive
    ? "bg-success/10 text-success border-success/30"
    : "bg-destructive/10 text-destructive border-destructive/30";
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = "default",
  delta,
  tone = "neutral",
  statusAccent,
  className,
  ...props
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-gradient-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-px hover:shadow-elevated",
        statusAccent && "border-t-[3px]",
        statusAccent && STATUS_ACCENT_BORDER[statusAccent],
        className
      )}
      {...props}
    >
      {tone === "premium" && !statusAccent && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent"
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {icon && (
          <div className={cn("opacity-70", ACCENT[accent])}>{icon}</div>
        )}
      </div>
      <div
        className={cn(
          "mt-3 font-display text-3xl font-semibold leading-none",
          ACCENT[accent]
        )}
      >
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              deltaTone(delta)
            )}
          >
            {delta.trend === "up" && <ArrowUpRight className="h-3 w-3" />}
            {delta.trend === "down" && <ArrowDownRight className="h-3 w-3" />}
            {delta.trend === "flat" && <Minus className="h-3 w-3" />}
            {delta.value}
          </span>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
