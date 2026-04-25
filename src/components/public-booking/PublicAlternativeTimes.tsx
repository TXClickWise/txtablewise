// Alternative time suggestions when a chosen slot is full.
// Slots are always derived from the engine response — we never invent times.
import { Slot } from "@/services/publicBooking";
import { Clock } from "lucide-react";

export const PublicAlternativeTimes = ({
  alternatives,
  onSelect,
}: {
  alternatives: Slot[];
  onSelect: (slot: Slot) => void;
}) => {
  if (alternatives.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Clock className="h-4 w-4 text-primary" />
        <span className="font-medium">Wel beschikbaar in de buurt</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {alternatives.map((s) => (
          <button
            key={s.start_iso}
            type="button"
            onClick={() => onSelect(s)}
            className="h-12 rounded-lg border-2 border-border bg-card font-medium text-sm
                       hover:border-primary hover:bg-primary/5 active:scale-95 transition-all touch-manipulation"
          >
            {s.time}
          </button>
        ))}
      </div>
    </div>
  );
};
