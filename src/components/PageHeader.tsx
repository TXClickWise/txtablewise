import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  /** Maakt de header kleverig bovenaan (handig voor lange lijsten) */
  sticky?: boolean;
  className?: string;
}

/**
 * Eén consistente paginakop voor /app schermen.
 * Tablet-first: acties stapelen onder titel < md, blijven rechts ≥ md.
 */
export function PageHeader({
  title,
  description,
  badge,
  actions,
  sticky = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        sticky &&
          "sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/85 backdrop-blur border-b",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-display text-2xl sm:text-3xl leading-tight truncate">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap md:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
