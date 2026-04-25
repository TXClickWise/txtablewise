import * as React from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
  position?: "top" | "bottom";
}

/**
 * Sticky bar voor primaire operationele acties.
 * Blijft tijdens scroll bereikbaar — essentieel op tablet.
 */
export function StickyActionBar({ children, className, position = "bottom" }: Props) {
  return (
    <div
      className={cn(
        "sticky z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "border-border shadow-soft",
        position === "bottom" ? "bottom-0 border-t pt-3 pb-3" : "top-0 border-b pt-3 pb-3",
        "px-3 sm:px-4",
        className
      )}
    >
      <div className="flex flex-wrap gap-2 items-center">{children}</div>
    </div>
  );
}
