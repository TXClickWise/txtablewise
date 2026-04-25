// ReservationBadges — visual signals for hospitality scanning.
// Pure presentation: caller decides which flags to enable based on data.
import { cn } from "@/lib/utils";
import {
  AlertTriangle, Beer, Crown, Gift, ShieldAlert, Sparkles,
  TimerReset, UserPlus, Users, MailCheck, MessageCircleWarning,
} from "lucide-react";

type Tone = "info" | "success" | "warn" | "danger" | "muted";

const TONE: Record<Tone, string> = {
  info:    "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/25",
  warn:    "bg-warning/10 text-warning border-warning/25",
  danger:  "bg-destructive/10 text-destructive border-destructive/25",
  muted:   "bg-muted text-muted-foreground border-border",
};

type Badge = { label: string; tone: Tone; icon: React.ComponentType<{ className?: string }> };

export type ReservationFlags = {
  partySize: number;
  isWalkIn?: boolean;
  isVip?: boolean;
  hasAllergy?: boolean;
  hasPreOrder?: boolean;
  occasion?: string | null;
  largeGroupThreshold?: number;
  requiresManualApproval?: boolean;
  largeGroupStatus?: string | null;
  reminderConfirmed?: boolean;
  startTimeIso?: string;
  status?: string;
};

export function buildBadges(f: ReservationFlags): Badge[] {
  const out: Badge[] = [];
  if (f.isWalkIn) out.push({ label: "Walk-in", tone: "info", icon: UserPlus });
  if (f.partySize && f.largeGroupThreshold && f.partySize >= f.largeGroupThreshold) {
    out.push({ label: "Grote groep", tone: "warn", icon: Users });
  }
  if (f.requiresManualApproval) out.push({ label: "Goedkeuring nodig", tone: "warn", icon: ShieldAlert });
  if (f.largeGroupStatus === "awaiting_approval") {
    out.push({ label: "Wacht op goedkeuring", tone: "warn", icon: ShieldAlert });
  }
  if (f.isVip) out.push({ label: "VIP", tone: "success", icon: Crown });
  if (f.hasAllergy) out.push({ label: "Allergie", tone: "danger", icon: AlertTriangle });
  if (f.hasPreOrder) out.push({ label: "Drankje klaarzetten", tone: "info", icon: Beer });
  if (f.occasion) out.push({ label: f.occasion, tone: "info", icon: Gift });
  if (f.reminderConfirmed) out.push({ label: "Herbevestigd", tone: "success", icon: MailCheck });

  // Late / no-show risk: only relevant for confirmed/pending in the past
  if (f.startTimeIso && (f.status === "confirmed" || f.status === "pending")) {
    const diffMin = (Date.now() - new Date(f.startTimeIso).getTime()) / 60_000;
    if (diffMin > 15) out.push({ label: "Te laat", tone: "danger", icon: TimerReset });
    else if (diffMin > 5) out.push({ label: "Mogelijk te laat", tone: "warn", icon: MessageCircleWarning });
  }
  return out;
}

export function ReservationBadges({
  flags, max, className,
}: { flags: ReservationFlags; max?: number; className?: string }) {
  const badges = buildBadges(flags);
  const shown = max ? badges.slice(0, max) : badges;
  const remaining = max ? Math.max(0, badges.length - max) : 0;
  if (shown.length === 0) return null;
  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {shown.map((b, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
            TONE[b.tone],
          )}
        >
          <b.icon className="h-3 w-3" />
          {b.label}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-[11px] text-muted-foreground">+{remaining}</span>
      )}
    </div>
  );
}

// Tiny helper used by callers when no data set is available.
export const SparkleHint = Sparkles;
