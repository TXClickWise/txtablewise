// LargeGroupsPage — operator workspace for large parties.
// Two queues:
//   1. Reservations flagged requires_manual_approval (or large_group_status=awaiting_approval)
//      → operator can approve (→ confirmed) or decline (→ cancelled).
//   2. Approved/auto-booked group reservations for upcoming days.
// Plus a public inbox of `large_group_requests` (form-style aanvragen).
//
// All status changes go through the reservations service so audit_log and
// integration_events stay consistent. No payment processing yet.

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  CheckCircle2, XCircle, ShieldAlert, Users, Wallet, MessageSquare,
  RefreshCw, Inbox, CalendarClock, Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { reservations as resService } from "@/services/reservations";
import { ReservationDetailDialog } from "@/components/ReservationDetailDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RestaurantConfig = {
  large_group_threshold: number;
  large_group_extra_minutes: number;
  large_group_manual_approval_from: number;
  large_group_deposit_recommended_from: number;
  large_group_auto_book_max: number;
};

type GroupReservation = {
  id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  party_size: number;
  status: string;
  channel: string;
  occasion: string | null;
  special_requests: string | null;
  internal_notes: string | null;
  requires_manual_approval: boolean | null;
  large_group_status: string | null;
  guests: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
  reservation_tables: Array<{ tables: { label: string | null } | null }> | null;
};

type LargeGroupRequest = {
  id: string;
  created_at: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  party_size: number;
  preferred_date: string | null;
  preferred_time: string | null;
  occasion: string | null;
  message: string | null;
  status: string;
};

const LargeGroupsPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();

  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ id: string; kind: "approve" | "decline" } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["large-group-config", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants")
        .select("large_group_threshold, large_group_extra_minutes, large_group_manual_approval_from, large_group_deposit_recommended_from, large_group_auto_book_max")
        .eq("id", restaurantId!).maybeSingle();
      return data as RestaurantConfig | null;
    },
  });

  const threshold = config?.large_group_threshold ?? 8;
  const depositFrom = config?.large_group_deposit_recommended_from ?? 8;

  const { data: groupReservations = [], isLoading, refetch } = useQuery({
    queryKey: ["large-group-reservations", restaurantId, threshold],
    enabled: !!restaurantId,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase.from("reservations")
        .select(`
          id, reservation_date, start_time, end_time, party_size, status, channel,
          occasion, special_requests, internal_notes,
          requires_manual_approval, large_group_status,
          guests(first_name, last_name, email, phone),
          reservation_tables(tables(label))
        `)
        .eq("restaurant_id", restaurantId!)
        .gte("reservation_date", today)
        .gte("party_size", threshold)
        .order("reservation_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GroupReservation[];
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["large-group-requests", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("large_group_requests")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as LargeGroupRequest[];
    },
  });

  const pending = useMemo(
    () => groupReservations.filter((r) =>
      (r.requires_manual_approval || r.large_group_status === "awaiting_approval") &&
      !["cancelled", "no_show", "completed"].includes(r.status),
    ),
    [groupReservations],
  );
  const approved = useMemo(
    () => groupReservations.filter((r) =>
      !pending.includes(r) &&
      ["confirmed", "seated"].includes(r.status),
    ),
    [groupReservations, pending],
  );
  const newRequests = requests.filter((r) => r.status === "new");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["large-group-reservations"] });
    qc.invalidateQueries({ queryKey: ["large-group-requests"] });
    qc.invalidateQueries({ queryKey: ["reservations-day"] });
    qc.invalidateQueries({ queryKey: ["today-reservations"] });
  };

  const runDecision = async () => {
    if (!decision) return;
    setBusy(true);
    const res = decision.kind === "approve"
      ? await resService.approveLargeGroup(decision.id)
      : await resService.declineLargeGroup(decision.id, declineReason || undefined);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "Actie mislukt.");
      return;
    }
    toast.success(decision.kind === "approve"
      ? "Groepsreservering goedgekeurd."
      : "Groepsaanvraag afgewezen — gast krijgt bericht via ClickWise (later).");
    setDecision(null);
    setDeclineReason("");
    refresh();
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Grote groepen</h1>
          <p className="text-muted-foreground text-sm">
            Groepsreserveringen vragen vaak meer voorbereiding. Hier beoordeel je aanvragen en zie je het overzicht.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Vernieuwen
          </Button>
          <Button variant="outline" className="h-10" asChild>
            <Link to="/app/instellingen/grote-groepen">
              <Settings className="h-4 w-4 mr-1.5" /> Instellingen
            </Link>
          </Button>
        </div>
      </div>

      {/* Config summary */}
      {config && (
        <Card>
          <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <ConfigChip label="Grote groep vanaf" value={`${config.large_group_threshold}p`} />
            <ConfigChip label="Extra duur" value={`+${config.large_group_extra_minutes}m`} />
            <ConfigChip label="Goedkeuring vanaf" value={`${config.large_group_manual_approval_from}p`} />
            <ConfigChip label="Aanbetaling gewenst" value={`${config.large_group_deposit_recommended_from}p+`} />
            <ConfigChip label="Auto boeken tot" value={`${config.large_group_auto_book_max}p`} />
          </CardContent>
        </Card>
      )}

      {/* Pending approval */}
      <Section
        icon={<ShieldAlert className="h-5 w-5 text-warning" />}
        title="Wacht op goedkeuring"
        count={pending.length}
        empty="Geen openstaande aanvragen — fijn rustig moment."
      >
        {pending.map((r) => (
          <GroupReservationRow
            key={r.id}
            r={r}
            depositFrom={depositFrom}
            actions={
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="sm" variant="outline"
                  onClick={() => setDecision({ id: r.id, kind: "decline" })}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Afwijzen
                </Button>
                <Button
                  size="sm"
                  onClick={() => setDecision({ id: r.id, kind: "approve" })}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Goedkeuren
                </Button>
              </div>
            }
            onOpen={() => setSelectedReservationId(r.id)}
          />
        ))}
      </Section>

      {/* Approved upcoming */}
      <Section
        icon={<CalendarClock className="h-5 w-5 text-success" />}
        title="Goedgekeurde groepsreserveringen"
        count={approved.length}
        empty="Nog geen geplande groepsreserveringen."
        loading={isLoading}
      >
        {approved.map((r) => (
          <GroupReservationRow
            key={r.id}
            r={r}
            depositFrom={depositFrom}
            actions={
              <Button size="sm" variant="ghost" onClick={() => setSelectedReservationId(r.id)}>
                Bekijken
              </Button>
            }
            onOpen={() => setSelectedReservationId(r.id)}
          />
        ))}
      </Section>

      {/* Public inbox */}
      <Section
        icon={<Inbox className="h-5 w-5 text-primary" />}
        title="Aanvragen via formulier"
        count={newRequests.length}
        empty="Geen nieuwe aanvragen via het publieke formulier."
        subtitle="Aanvragen via de website komen hier binnen. Bel of mail terug om in een echte reservering om te zetten."
      >
        {requests.map((req) => (
          <RequestRow key={req.id} req={req} />
        ))}
      </Section>

      <ReservationDetailDialog
        reservationId={selectedReservationId}
        open={!!selectedReservationId}
        onOpenChange={(o) => !o && setSelectedReservationId(null)}
      />

      <AlertDialog open={!!decision} onOpenChange={(o) => { if (!o) { setDecision(null); setDeclineReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision?.kind === "approve" ? "Groepsreservering goedkeuren?" : "Groepsaanvraag afwijzen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decision?.kind === "approve"
                ? "De reservering wordt bevestigd. ClickWise stuurt later automatisch een bevestiging naar de gast."
                : "De reservering wordt geannuleerd. Geef optioneel een reden mee — die helpt bij de bevestigingsmail aan de gast."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {decision?.kind === "decline" && (
            <Textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Bijv. helaas vol op deze datum — graag een ander moment voorstellen."
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Terug</AlertDialogCancel>
            <AlertDialogAction onClick={runDecision} disabled={busy}>
              {busy ? "Bezig…" : decision?.kind === "approve" ? "Ja, goedkeuren" : "Ja, afwijzen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function Section({
  icon, title, count, empty, loading, subtitle, children,
}: {
  icon: React.ReactNode; title: string; count: number;
  empty: string; loading?: boolean; subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-display text-lg">{title}</h2>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{count}</span>
        </div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {loading ? (
          <div className="space-y-2">{[0, 1].map((i) => (
            <div key={i} className="h-16 rounded-md bg-muted/40 animate-pulse" />
          ))}</div>
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground italic py-3">{empty}</p>
        ) : (
          <div className="space-y-2">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfigChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function GroupReservationRow({
  r, depositFrom, actions, onOpen,
}: {
  r: GroupReservation; depositFrom: number;
  actions: React.ReactNode; onOpen: () => void;
}) {
  const guest = r.guests;
  const tables = (r.reservation_tables ?? []).map((rt) => rt?.tables?.label).filter(Boolean).join(", ");
  const recommendDeposit = r.party_size >= depositFrom;
  return (
    <div className="rounded-md border border-border p-3 flex items-start gap-3 flex-wrap">
      <button onClick={onOpen} className="text-left min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">
            {guest?.first_name ?? "Gast"} {guest?.last_name ?? ""}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border bg-warning/10 text-warning border-warning/25 px-1.5 py-0.5 text-[11px]">
            <Users className="h-3 w-3" /> {r.party_size}p
          </span>
          {r.occasion && (
            <span className="text-[11px] text-muted-foreground">· {r.occasion}</span>
          )}
          {recommendDeposit && (
            <span className="inline-flex items-center gap-1 rounded-md border bg-primary/10 text-primary border-primary/20 px-1.5 py-0.5 text-[11px]">
              <Wallet className="h-3 w-3" /> Aanbetaling gewenst
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-0.5">
          {format(new Date(r.start_time), "EEE d MMM · HH:mm", { locale: nl })}
          {tables && <> · Tafel {tables}</>}
          {guest?.phone && <> · {guest.phone}</>}
        </div>
        {(r.special_requests || r.internal_notes) && (
          <div className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
            {r.special_requests}{r.internal_notes ? ` — ${r.internal_notes}` : ""}
          </div>
        )}
      </button>
      <div className="shrink-0">{actions}</div>
    </div>
  );
}

function RequestRow({ req }: { req: LargeGroupRequest }) {
  return (
    <div className="rounded-md border border-border p-3 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{req.contact_name}</span>
        <span className="text-[11px] rounded-md bg-warning/10 text-warning border border-warning/25 px-1.5 py-0.5">
          {req.party_size}p
        </span>
        <span className={cn(
          "text-[11px] rounded-md px-1.5 py-0.5",
          req.status === "new" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}>{req.status}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {format(new Date(req.created_at), "d MMM HH:mm", { locale: nl })}
        </span>
      </div>
      <div className="text-sm text-muted-foreground">
        {req.preferred_date && format(new Date(req.preferred_date), "EEE d MMM", { locale: nl })}
        {req.preferred_time && ` · ${req.preferred_time.slice(0, 5)}`}
        {req.occasion && ` · ${req.occasion}`}
      </div>
      <div className="text-xs text-muted-foreground">
        {[req.contact_phone, req.contact_email].filter(Boolean).join(" · ")}
      </div>
      {req.message && (
        <div className="text-sm italic mt-1 bg-muted/30 rounded px-2 py-1.5">"{req.message}"</div>
      )}
    </div>
  );
}

export default LargeGroupsPage;
