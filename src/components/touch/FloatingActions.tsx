import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X, Hand, CalendarPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsCompact } from "@/hooks/use-breakpoint";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { WalkInQuickSheet, type WalkInQuickPrefill } from "@/components/walk-in/WalkInQuickSheet";
import { AIQuickSeatInput } from "@/components/walk-in/AIQuickSeatInput";
import { ReservationFormSheet } from "@/components/reservations/ReservationFormSheet";

/**
 * Globale Floating Action Button.
 * Toont 3 opties (Walk-in, Reservering, AI Quick Seat) op operationele schermen.
 */
export function FloatingActions() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const isCompact = useIsCompact();

  const [open, setOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [walkInPrefill, setWalkInPrefill] = useState<WalkInQuickPrefill | undefined>();

  const { data: zones = [] } = useQuery({
    queryKey: ["zones", restaurantId],
    enabled: !!restaurantId && aiSheetOpen,
    queryFn: async () => {
      const { data } = await supabase.from("zones")
        .select("id, name")
        .eq("restaurant_id", restaurantId!)
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  // Sluit menu bij Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!restaurantId) return null;

  const positionClasses = isCompact
    ? "fixed bottom-20 right-4"
    : "fixed bottom-6 right-6";

  return (
    <>
      {/* Backdrop wanneer menu open */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-background/30 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className={cn(positionClasses, "z-40 flex flex-col items-end gap-3")}>
        {/* Fan-out opties */}
        {open && (
          <div className="flex flex-col items-end gap-2">
            <FabOption
              label="AI Quick Seat"
              icon={<Sparkles className="h-5 w-5 text-primary" />}
              onClick={() => { setAiSheetOpen(true); setOpen(false); }}
              delay={150}
            />
            <FabOption
              label="Reservering"
              icon={<CalendarPlus className="h-5 w-5" />}
              onClick={() => { setReservationOpen(true); setOpen(false); }}
              delay={75}
            />
            <FabOption
              label="Walk-in"
              icon={<Hand className="h-5 w-5" />}
              onClick={() => { setWalkInPrefill(undefined); setWalkInOpen(true); setOpen(false); }}
              delay={0}
            />
          </div>
        )}

        <Button
          size="icon"
          aria-label={open ? "Sluit acties" : "Open snelle acties"}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className={cn(
            "fab-button h-14 w-14 rounded-full",
            open && "rotate-45",
          )}
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>

      <WalkInQuickSheet
        open={walkInOpen}
        onOpenChange={(o) => { setWalkInOpen(o); if (!o) setWalkInPrefill(undefined); }}
        prefill={walkInPrefill}
      />

      <ReservationFormSheet
        open={reservationOpen}
        onOpenChange={setReservationOpen}
      />

      {/* AI Quick Seat → na bevestiging opent WalkInQuickSheet met prefill */}
      <Sheet open={aiSheetOpen} onOpenChange={setAiSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" /> AI Quick Seat
            </SheetTitle>
            <SheetDescription>
              Beschrijf in één zin wat je nodig hebt. Bevestig om verder te gaan.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <AIQuickSeatInput
              zones={zones}
              onConfirm={(prefill) => {
                setWalkInPrefill(prefill);
                setAiSheetOpen(false);
                setWalkInOpen(true);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function FabOption({ label, icon, onClick, delay = 0 }: { label: string; icon: React.ReactNode; onClick: () => void; delay?: number }) {
  return (
    <div
      className="flex items-center gap-2 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 fill-mode-both"
      style={{ animationDelay: `${delay}ms`, animationDuration: "200ms" }}
    >
      <span className="rounded-md bg-card px-3 py-1.5 text-sm font-medium shadow-elevated border border-border">
        {label}
      </span>
      <Button
        size="icon"
        variant="secondary"
        onClick={onClick}
        className="h-12 w-12 rounded-full shadow-elevated hover:-translate-y-0.5"
        aria-label={label}
      >
        {icon}
      </Button>
    </div>
  );
}
