import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useIsCompact } from "@/hooks/use-breakpoint";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Force layout (handig voor consistente module-keuze) */
  forceLayout?: "sheet-bottom" | "sheet-right";
}

/**
 * Responsive detailpaneel:
 * - tablet-landscape / desktop → side panel rechts (sheet "right")
 * - mobile / tablet-portrait → bottom sheet
 * Met sticky footer voor primaire acties.
 */
export function ResponsiveDetailPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  forceLayout,
}: Props) {
  const compact = useIsCompact();
  const side: "right" | "bottom" =
    forceLayout === "sheet-bottom" ? "bottom" :
    forceLayout === "sheet-right" ? "right" :
    compact ? "bottom" : "right";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "flex flex-col p-0 gap-0",
          side === "right"
            ? "w-full sm:max-w-lg lg:max-w-xl"
            : "h-[92vh] max-h-[92vh] rounded-t-2xl"
        )}
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0 text-left">
          <SheetTitle className="text-xl font-display">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t bg-background/95 backdrop-blur px-4 py-3">
            <div className="flex flex-wrap gap-2 justify-end">{footer}</div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
