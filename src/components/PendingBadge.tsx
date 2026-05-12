import { cn } from "@/lib/utils";

interface PendingBadgeProps {
  count: number;
  variant?: "sidebar" | "tab" | "dot";
  className?: string;
  label?: string;
}

/**
 * Rode pulse-badge voor openstaande aanvragen die de aandacht van de operator nodig hebben.
 * - sidebar: compacte pill rechts in een sidebar-item
 * - tab:     ronde pill naast een tab-label, met glow-ring
 * - dot:     kleine rode dot (voor collapsed sidebar bij icoon)
 */
export function PendingBadge({ count, variant = "sidebar", className, label }: PendingBadgeProps) {
  if (!count || count <= 0) return null;
  const display = count > 9 ? "9+" : String(count);
  const ariaLabel = label ?? `${count} aanvragen wachten op beoordeling`;

  if (variant === "dot") {
    return (
      <span
        aria-label={ariaLabel}
        className={cn(
          "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive",
          "ring-2 ring-sidebar animate-pulse",
          className,
        )}
      />
    );
  }

  if (variant === "tab") {
    return (
      <span
        aria-label={ariaLabel}
        className={cn(
          "ml-1.5 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5",
          "rounded-full bg-destructive text-destructive-foreground",
          "text-[11px] font-bold leading-none tabular-nums",
          "shadow-[0_0_0_3px_hsl(var(--destructive)/0.25)] animate-pulse",
          className,
        )}
      >
        {display}
      </span>
    );
  }

  // sidebar variant
  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        "ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5",
        "rounded-full bg-destructive text-destructive-foreground",
        "text-[10px] font-bold leading-none tabular-nums",
        "shadow-[0_0_0_2px_hsl(var(--destructive)/0.25)] animate-pulse",
        className,
      )}
    >
      {display}
    </span>
  );
}
