import * as React from "react";
import { useIsTabletLandscapeOrLarger } from "@/hooks/use-breakpoint";
import { cn } from "@/lib/utils";

interface Props {
  left: React.ReactNode;
  right: React.ReactNode;
  /** Wanneer ingeklapt (mobiel/portrait): toon dit (meestal `right` of `left`) */
  compactMode?: "left" | "right" | "both";
  leftClassName?: string;
  rightClassName?: string;
  className?: string;
}

/**
 * Split-view voor tablet landscape (Dagoverzicht, Floor Mode):
 * - landscape+: 2 koloms naast elkaar
 * - kleiner: stack of single side
 */
export function TabletSplitView({
  left,
  right,
  compactMode = "both",
  leftClassName,
  rightClassName,
  className,
}: Props) {
  const wide = useIsTabletLandscapeOrLarger();

  if (wide) {
    return (
      <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]", className)}>
        <div className={cn("min-w-0", leftClassName)}>{left}</div>
        <div className={cn("min-w-0", rightClassName)}>{right}</div>
      </div>
    );
  }

  if (compactMode === "left") return <div className={cn(leftClassName, className)}>{left}</div>;
  if (compactMode === "right") return <div className={cn(rightClassName, className)}>{right}</div>;

  return (
    <div className={cn("space-y-4", className)}>
      <div className={leftClassName}>{left}</div>
      <div className={rightClassName}>{right}</div>
    </div>
  );
}
