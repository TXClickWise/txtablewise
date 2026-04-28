import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface SectionCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  /** Maakt de hover-shadow zwaarder; standaard subtiele lift */
  emphasize?: boolean;
  /** Verwijder padding van CardContent (handig voor tabellen of plattegronden) */
  noPadding?: boolean;
  contentClassName?: string;
  children?: React.ReactNode;
}

/**
 * Gestandaardiseerde sectie-kaart met dezelfde shadow/gradient look op alle pagina's.
 * Gebruikt bestaande shadcn Card primitives — geen wijziging in styling tokens.
 */
export function SectionCard({
  title,
  description,
  icon,
  actions,
  emphasize = false,
  noPadding = false,
  className,
  contentClassName,
  children,
  ...props
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        "bg-gradient-card shadow-soft transition-smooth",
        emphasize ? "hover:shadow-lifted" : "hover:shadow-elegant",
        className
      )}
      {...props}
    >
      {(title || actions) && (
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 space-y-1">
            {title && (
              <CardTitle className="font-display text-lg sm:text-xl flex items-center gap-2">
                {icon && (
                  <span className="text-primary [&>svg]:h-5 [&>svg]:w-5">
                    {icon}
                  </span>
                )}
                <span className="truncate">{title}</span>
              </CardTitle>
            )}
            {description && (
              <CardDescription className="text-sm">{description}</CardDescription>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </CardHeader>
      )}
      <CardContent className={cn(noPadding && "p-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
