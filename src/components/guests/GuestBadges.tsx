// Hospitality-vriendelijke badges voor gasten.
import { cn } from "@/lib/utils";
import {
  AlertTriangle, Crown, UserCheck, UserPlus, MailCheck, Sun, Leaf,
  Users, BellRing, MessageCircle,
} from "lucide-react";
import type { Guest } from "@/services/guests";

type Tone = "info" | "success" | "warn" | "danger" | "muted";
const TONE: Record<Tone, string> = {
  info:    "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/25",
  warn:    "bg-warning/10 text-warning border-warning/25",
  danger:  "bg-destructive/10 text-destructive border-destructive/25",
  muted:   "bg-muted text-muted-foreground border-border",
};

type B = { label: string; tone: Tone; Icon: React.ComponentType<{ className?: string }> };

export function buildGuestBadges(g: Guest, opts?: { largeGroupCount?: number }): B[] {
  const out: B[] = [];
  if ((g.total_visits ?? 0) >= 2) out.push({ label: "Terugkerende gast", tone: "success", Icon: UserCheck });
  if ((g.total_visits ?? 0) <= 0) out.push({ label: "Nieuwe gast", tone: "info", Icon: UserPlus });
  if (g.is_vip) out.push({ label: "VIP", tone: "success", Icon: Crown });
  if (g.allergies) out.push({ label: "Allergie", tone: "danger", Icon: AlertTriangle });
  if (g.dietary_preferences) out.push({ label: "Dieetwens", tone: "info", Icon: Leaf });
  const seat = (g.seating_preferences ?? "").toLowerCase();
  if (seat.includes("terras")) out.push({ label: "Terrasvoorkeur", tone: "info", Icon: Sun });
  if (seat.includes("rustig")) out.push({ label: "Rustige tafel", tone: "info", Icon: Leaf });
  if ((opts?.largeGroupCount ?? 0) > 0) out.push({ label: "Grote groep boeker", tone: "info", Icon: Users });
  if (g.source_channel === "walk_in") out.push({ label: "Walk-in gast", tone: "muted", Icon: UserPlus });
  if (g.no_show_count > 0) out.push({ label: "Extra bevestiging aanbevolen", tone: "warn", Icon: BellRing });
  if (g.marketing_consent) out.push({ label: "Marketing opt-in", tone: "muted", Icon: MailCheck });
  if (g.preferred_channel === "whatsapp") out.push({ label: "WhatsApp voorkeur", tone: "muted", Icon: MessageCircle });
  return out;
}

export function GuestBadges({ guest, max, largeGroupCount, className }: {
  guest: Guest; max?: number; largeGroupCount?: number; className?: string;
}) {
  const badges = buildGuestBadges(guest, { largeGroupCount });
  const shown = max ? badges.slice(0, max) : badges;
  const remaining = max ? Math.max(0, badges.length - max) : 0;
  if (shown.length === 0) return null;
  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {shown.map((b, i) => (
        <span key={i} className={cn(
          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
          TONE[b.tone],
        )}>
          <b.Icon className="h-3 w-3" />
          {b.label}
        </span>
      ))}
      {remaining > 0 && <span className="text-[11px] text-muted-foreground">+{remaining}</span>}
    </div>
  );
}
