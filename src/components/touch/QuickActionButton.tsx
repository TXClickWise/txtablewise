import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface Props extends ButtonProps {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  loading?: boolean;
  destructive?: boolean;
  primary?: boolean;
}

/**
 * Grote, scanbare touch-knop voor operationele schermen (Floor Mode, walk-ins).
 * Min hoogte 56px voor primaire acties.
 */
export const QuickActionButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ icon, label, description, loading, destructive, primary, className, disabled, ...rest }, ref) => {
    return (
      <Button
        ref={ref}
        variant={destructive ? "destructive" : primary ? "default" : "outline"}
        disabled={disabled || loading}
        className={cn(
          "h-auto min-h-[56px] px-4 py-3 flex items-center gap-3 justify-start text-left rounded-xl",
          "active:scale-[0.98] transition-transform",
          className
        )}
        {...rest}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
        ) : icon ? (
          <span className="shrink-0 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        ) : null}
        <span className="flex flex-col leading-tight min-w-0">
          <span className="font-semibold text-base truncate">{label}</span>
          {description && (
            <span className="text-xs opacity-80 font-normal truncate">{description}</span>
          )}
        </span>
      </Button>
    );
  }
);
QuickActionButton.displayName = "QuickActionButton";
