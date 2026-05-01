// Step indicator for the public booking flow.
// Guestplan-style: only 2 visible steps (Tijd kiezen → Gegevens & bevestigen).
import { cn } from "@/lib/utils";

export type BookingStepId = "select" | "details" | "confirmed";

const VISIBLE_STEPS: { id: BookingStepId; label: string }[] = [
  { id: "select", label: "Tijd kiezen" },
  { id: "details", label: "Gegevens & bevestigen" },
];

export const PublicBookingProgress = ({ current }: { current: BookingStepId }) => {
  if (current === "confirmed") return null;
  const idx = VISIBLE_STEPS.findIndex((s) => s.id === current);
  const total = VISIBLE_STEPS.length;
  const pct = ((idx + 1) / total) * 100;
  return (
    <div className="space-y-2" aria-label="Voortgang reservering">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">
          Stap {idx + 1} van {total} · {VISIBLE_STEPS[idx]?.label}
        </span>
        <span className="text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full bg-primary transition-all duration-300 ease-out")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
