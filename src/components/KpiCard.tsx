import * as React from "react";
import { cn } from "@/lib/utils";

interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: "default" | "primary" | "success" | "warning" | "destructive";
}

const ACCENT: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function KpiCard({ label, value, hint, icon, accent = "default", className, ...props }: KpiCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-gradient-card p-5 shadow-soft transition-smooth hover:shadow-elegant",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        {icon && <div className={cn("opacity-70", ACCENT[accent])}>{icon}</div>}
      </div>
      <div className={cn("mt-3 font-display text-3xl font-semibold leading-none", ACCENT[accent])}>{value}</div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
