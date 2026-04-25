// PacingIndicator — visual hint of how busy a moment is.
// Pure presentation; caller passes computed level + counts.
import { cn } from "@/lib/utils";

export type PacingLevel = "calm" | "normal" | "busy" | "full";

const LABELS: Record<PacingLevel, string> = {
  calm:   "Rustig",
  normal: "Normaal",
  busy:   "Druk",
  full:   "Operationeel vol",
};

const STYLES: Record<PacingLevel, string> = {
  calm:   "bg-muted text-muted-foreground border-border",
  normal: "bg-primary/10 text-primary border-primary/20",
  busy:   "bg-warning/15 text-warning border-warning/30",
  full:   "bg-destructive/15 text-destructive border-destructive/30",
};

export function PacingIndicator({
  level, covers, className,
}: { level: PacingLevel; covers?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STYLES[level],
        className,
      )}
      title={covers !== undefined ? `${covers} couverts` : LABELS[level]}
    >
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        level === "calm"   && "bg-muted-foreground",
        level === "normal" && "bg-primary",
        level === "busy"   && "bg-warning",
        level === "full"   && "bg-destructive",
      )} />
      {LABELS[level]}
      {covers !== undefined && <span className="opacity-70">· {covers}p</span>}
    </span>
  );
}

/** Rough heuristic when no explicit pacing config exists yet. */
export function pacingLevelFromCovers(covers: number, capacity?: number | null): PacingLevel {
  if (!capacity || capacity <= 0) {
    if (covers <= 4) return "calm";
    if (covers <= 12) return "normal";
    if (covers <= 24) return "busy";
    return "full";
  }
  const ratio = covers / capacity;
  if (ratio < 0.4) return "calm";
  if (ratio < 0.75) return "normal";
  if (ratio < 1) return "busy";
  return "full";
}
