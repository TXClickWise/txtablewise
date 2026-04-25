// Reusable badges for no-show prevention & deposits.
// Pure presentation — colour comes from semantic tokens in index.css.
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Clock, MailCheck, MailQuestion, ShieldAlert,
  ShieldCheck, ShieldX, AlertTriangle, Wallet, BadgeCheck,
} from "lucide-react";
import type { RiskLevel } from "@/lib/noShowSignal";

type Tone = "info" | "success" | "warn" | "danger" | "muted";

const TONE: Record<Tone, string> = {
  info:    "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/25",
  warn:    "bg-warning/10 text-warning border-warning/25",
  danger:  "bg-destructive/10 text-destructive border-destructive/25",
  muted:   "bg-muted text-muted-foreground border-border",
};

function Badge({
  tone, icon: Icon, children, className,
}: { tone: Tone; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
      TONE[tone], className,
    )}>
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}

// Reconfirmation status — what stage are we in with the guest?
export function ReconfirmationStatusBadge({ status }: { status?: string | null }) {
  if (!status || status === "not_required") return null;
  switch (status) {
    case "pending":
      return <Badge tone="muted" icon={Clock}>Herbevestiging klaar</Badge>;
    case "requested":
      return <Badge tone="warn" icon={MailQuestion}>Herbevestiging open</Badge>;
    case "confirmed":
      return <Badge tone="success" icon={MailCheck}>Gast bevestigd</Badge>;
    case "declined":
      return <Badge tone="danger" icon={ShieldX}>Gast kan niet komen</Badge>;
    case "expired":
      return <Badge tone="muted" icon={Clock}>Herbevestiging verlopen</Badge>;
    default:
      return null;
  }
}

// Confirmation status — initial booking confirmation channel.
export function ConfirmationStatusBadge({ status }: { status?: string | null }) {
  if (!status || status === "not_sent") return null;
  switch (status) {
    case "pending":
    case "scheduled":
      return <Badge tone="muted" icon={Clock}>Bevestiging klaar</Badge>;
    case "sent":
      return <Badge tone="info" icon={MailCheck}>Bevestiging voorbereid</Badge>;
    case "confirmed":
      return <Badge tone="success" icon={CheckCircle2}>Bevestigd</Badge>;
    case "failed":
      return <Badge tone="danger" icon={AlertTriangle}>Bevestiging mislukt</Badge>;
    default:
      return null;
  }
}

// No-show internal risk indicator — never shown to the guest.
export function NoShowRiskBadge({ level }: { level?: RiskLevel | null }) {
  if (!level || level === "low") return null;
  if (level === "medium") return <Badge tone="warn" icon={AlertTriangle}>Extra bevestiging aanbevolen</Badge>;
  return <Badge tone="danger" icon={AlertTriangle}>Handmatige check aanbevolen</Badge>;
}

// Deposit / reserveringsgarantie status.
export function DepositStatusBadge({
  status, amountCents,
}: { status?: string | null; amountCents?: number | null }) {
  if (!status || status === "not_required") return null;
  const amount = amountCents != null && amountCents > 0
    ? ` · €${(amountCents / 100).toFixed(2).replace(".", ",")}`
    : "";
  switch (status) {
    case "recommended":
      return <Badge tone="info" icon={Wallet}>Reserveringsgarantie aanbevolen{amount}</Badge>;
    case "required":
      return <Badge tone="warn" icon={ShieldAlert}>Reserveringsgarantie vereist{amount}</Badge>;
    case "pending":
      return <Badge tone="warn" icon={Clock}>Garantie open{amount}</Badge>;
    case "paid":
      return <Badge tone="success" icon={BadgeCheck}>Garantie ontvangen (handmatig){amount}</Badge>;
    case "waived":
      return <Badge tone="muted" icon={ShieldCheck}>Garantie vrijgesteld</Badge>;
    case "refunded":
      return <Badge tone="muted" icon={Wallet}>Garantie terugbetaald</Badge>;
    case "failed":
      return <Badge tone="danger" icon={AlertTriangle}>Garantie mislukt</Badge>;
    default:
      return null;
  }
}
