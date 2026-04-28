import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, addDays, startOfDay, endOfDay } from "date-fns";
import { nl } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge as UIBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, LoadingState } from "@/components/touch/StateViews";
import { toast } from "sonner";
import { reservations as resService } from "@/services/reservations";
import { calculateNoShowSignal, RISK_LABEL } from "@/lib/noShowSignal";
import {
  ReconfirmationStatusBadge, NoShowRiskBadge, DepositStatusBadge,
} from "@/components/no-show/NoShowBadges";
import {
  CheckCircle2, XCircle, MailQuestion, Wallet, ShieldCheck,
  AlertTriangle, Sparkles, Phone, ArrowRight, Settings,
} from "lucide-react";
import { ReservationDetailDialog } from "@/components/ReservationDetailDialog";

type Reservation = {
  id: string;
  reservation_date: string;
  start_time: string;
  party_size: number;
  status: string;
  channel: string;
  reconfirmation_status: string | null;
  confirmation_status: string | null;
  reconfirmed_at: string | null;
  deposit_status: string | null;
  deposit_amount_cents: number | null;
  deposit_required: boolean | null;
  no_show_marked_at: string | null;
  large_group_status: string | null;
  requires_manual_approval: boolean;
  guests: {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    visit_count: number | null;
    no_show_count: number | null;
    is_vip: boolean | null;
  } | null;
};

const NoShowPreventionPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const horizon = useMemo(() => addDays(today, 2), [today]);

  // Restaurant settings for thresholds & deposit defaults
  const { data: rest } = useQuery({
    enabled: !!restaurantId,
    queryKey: ["restaurant-no-show-cfg", restaurantId],
    queryFn: async () => {
      const { data } = await supabase.from("restaurants")
        .select("large_group_threshold,large_group_deposit_recommended_from,deposit_default_amount_cents,noshow_risk_signal_enabled,noshow_reconfirmation_hours_before")
        .eq("id", restaurantId!).maybeSingle();
      return data;
    },
  });

  const { data: reservations = [], isLoading } = useQuery({
    enabled: !!restaurantId,
    queryKey: ["no-show-followup", restaurantId, format(today, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(`
          id, reservation_date, start_time, party_size, status, channel,
          reconfirmation_status, confirmation_status, reconfirmed_at,
          deposit_status, deposit_amount_cents, deposit_required,
          no_show_marked_at, large_group_status, requires_manual_approval,
          guests:guest_id ( id, full_name, first_name, last_name, phone, email, visit_count, no_show_count, is_vip )
        `)
        .eq("restaurant_id", restaurantId!)
        .gte("start_time", startOfDay(today).toISOString())
        .lte("start_time", endOfDay(horizon).toISOString())
        .in("status", ["pending", "confirmed", "seated"])
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Reservation[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["no-show-followup"] });
    qc.invalidateQueries({ queryKey: ["reservations-day"] });
    qc.invalidateQueries({ queryKey: ["today-reservations"] });
  };

  // Enrich each reservation with risk + flags.
  const enriched = useMemo(() => {
    const threshold = rest?.large_group_threshold ?? 9;
    const depositFrom = rest?.large_group_deposit_recommended_from ?? 8;
    return reservations.map((r) => {
      const signal = calculateNoShowSignal({
        partySize: r.party_size,
        largeGroupThreshold: threshold,
        hasPhone: !!r.guests?.phone,
        hasEmail: !!r.guests?.email,
        guestVisitCount: r.guests?.visit_count ?? 0,
        guestNoShowCount: r.guests?.no_show_count ?? 0,
        reconfirmationStatus: r.reconfirmation_status,
        startTimeIso: r.start_time,
      });
      const isLargeGroup = r.party_size >= threshold;
      const needsDeposit =
        r.party_size >= depositFrom &&
        (!r.deposit_status || r.deposit_status === "not_required");
      const startMinDiff = (Date.now() - new Date(r.start_time).getTime()) / 60_000;
      const isLate = startMinDiff > 10 && r.status !== "seated";
      const reconfirmOpen = r.reconfirmation_status === "requested";
      return { r, signal, isLargeGroup, needsDeposit, isLate, reconfirmOpen };
    });
  }, [reservations, rest]);

  // KPIs
  const kpis = useMemo(() => {
    const reconfirmOpen = enriched.filter((e) => e.reconfirmOpen).length;
    const highRisk = enriched.filter((e) => e.signal.level === "high").length;
    const depositOpen = enriched.filter((e) =>
      ["recommended", "required", "pending"].includes(e.r.deposit_status ?? ""),
    ).length;
    const lateNotSeated = enriched.filter((e) => e.isLate).length;
    return { reconfirmOpen, highRisk, depositOpen, lateNotSeated };
  }, [enriched]);

  // Today follow-up = anything that wants attention
  const followup = enriched.filter((e) =>
    e.reconfirmOpen ||
    e.signal.level !== "low" ||
    e.needsDeposit ||
    e.isLate ||
    !e.r.guests?.phone,
  );

  const markConfirmed = async (id: string) => {
    setBusyId(id);
    const res = await resService.markReconfirmed(id);
    setBusyId(null);
    if (!res.ok) return toast.error(res.error || "Niet opgeslagen");
    toast.success("Fijn, de gast heeft bevestigd dat hij komt.");
    refresh();
  };
  const markDeclined = async (id: string) => {
    setBusyId(id);
    const res = await resService.markReconfirmationDeclined(id);
    setBusyId(null);
    if (!res.ok) return toast.error(res.error || "Niet opgeslagen");
    toast.success("De tafel komt weer beschikbaar — controleer de wachtlijst.");
    refresh();
  };
  const markNoShow = async (id: string) => {
    if (!confirm("Markeer als no-show? Dit wordt opgeslagen in de gastgeschiedenis.")) return;
    setBusyId(id);
    const res = await resService.markNoShow(id);
    setBusyId(null);
    if (!res.ok) return toast.error(res.error || "Niet opgeslagen");
    toast.success("Reservering gemarkeerd als no-show.");
    refresh();
  };
  const recommendDeposit = async (id: string, amountCents: number) => {
    setBusyId(id);
    const res = await resService.setDepositStatus(id, "recommended", { deposit_amount_cents: amountCents });
    setBusyId(null);
    if (!res.ok) return toast.error(res.error || "Niet opgeslagen");
    toast.success("Reserveringsgarantie aanbevolen.");
    refresh();
  };
  const waiveDeposit = async (id: string) => {
    setBusyId(id);
    const res = await resService.setDepositStatus(id, "waived");
    setBusyId(null);
    if (!res.ok) return toast.error(res.error || "Niet opgeslagen");
    toast.success("Reserveringsgarantie vrijgesteld.");
    refresh();
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="No-show preventie"
        description="Maak het gasten makkelijk om hun reservering te bevestigen, wijzigen of op tijd te annuleren — zodat je tafels goed kunt plannen."
        badge={
          <UIBadge variant="outline" className="gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" /> Hospitality-first
          </UIBadge>
        }
        actions={
          <Button variant="outline" className="h-11" asChild>
            <Link to="/app/instellingen/no-show">
              <Settings className="h-4 w-4 mr-2" /> Instellingen
            </Link>
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Herbevestigingen open" value={kpis.reconfirmOpen} tone="premium" />
        <KpiCard
          label="Risico vandaag"
          value={kpis.highRisk}
          accent={kpis.highRisk > 0 ? "warning" : "default"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KpiCard label="Reserveringsgaranties open" value={kpis.depositOpen} icon={<Wallet className="h-5 w-5" />} />
        <KpiCard
          label="Te laat & nog niet seated"
          value={kpis.lateNotSeated}
          accent={kpis.lateNotSeated > 0 ? "destructive" : "default"}
        />
      </div>

      {/* Follow-up list */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="font-display">Vandaag opvolgen</CardTitle>
          <CardDescription>
            Reserveringen tot en met morgen die aandacht vragen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState label="Risico-reserveringen laden…" />
          ) : followup.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck />}
              title="Niets om op te volgen"
              description="Geen risico-reserveringen vandaag of morgen — je staat er goed voor."
            />
          ) : (
            <ul className="divide-y divide-border">
              {followup.map(({ r, signal, isLargeGroup, needsDeposit, isLate, reconfirmOpen }) => {
                const guestName =
                  r.guests?.full_name ||
                  [r.guests?.first_name, r.guests?.last_name].filter(Boolean).join(" ") ||
                  "Walk-in";
                const time = format(new Date(r.start_time), "EEE d MMM HH:mm", { locale: nl });
                const depositAmount = rest?.deposit_default_amount_cents ?? 1000;
                return (
                  <li key={r.id} className="py-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                    <button
                      onClick={() => setSelected(r.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-medium">{guestName}</span>
                        <span className="text-sm text-muted-foreground">· {r.party_size} pers · {time}</span>
                        {r.guests?.is_vip && <UIBadge variant="secondary" className="text-[10px]">VIP</UIBadge>}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap mt-1.5">
                        <ReconfirmationStatusBadge status={r.reconfirmation_status} />
                        <NoShowRiskBadge level={signal.level} />
                        <DepositStatusBadge status={r.deposit_status} amountCents={r.deposit_amount_cents} />
                        {isLate && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-destructive/25 bg-destructive/10 text-destructive px-1.5 py-0.5 text-[11px] font-medium">
                            <AlertTriangle className="h-3 w-3" /> Te laat
                          </span>
                        )}
                        {!r.guests?.phone && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-warning/25 bg-warning/10 text-warning px-1.5 py-0.5 text-[11px] font-medium">
                            <Phone className="h-3 w-3" /> Geen telefoon
                          </span>
                        )}
                      </div>
                      {signal.reasons.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {RISK_LABEL[signal.level]} · {signal.reasons.join(" · ")}
                        </div>
                      )}
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {reconfirmOpen && (
                        <>
                          <Button size="sm" variant="outline" disabled={busyId === r.id}
                            onClick={() => markConfirmed(r.id)}>
                            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Bevestigd
                          </Button>
                          <Button size="sm" variant="outline" disabled={busyId === r.id}
                            onClick={() => markDeclined(r.id)}>
                            <XCircle className="h-4 w-4 mr-1.5" /> Kan niet komen
                          </Button>
                        </>
                      )}
                      {needsDeposit && !isLargeGroup === false && (
                        <Button size="sm" variant="outline" disabled={busyId === r.id}
                          onClick={() => recommendDeposit(r.id, depositAmount * r.party_size)}>
                          <Wallet className="h-4 w-4 mr-1.5" /> Garantie aanbevelen
                        </Button>
                      )}
                      {["recommended", "required", "pending"].includes(r.deposit_status ?? "") && (
                        <Button size="sm" variant="ghost" disabled={busyId === r.id}
                          onClick={() => waiveDeposit(r.id)}>
                          <ShieldCheck className="h-4 w-4 mr-1.5" /> Vrijstellen
                        </Button>
                      )}
                      {isLate && (
                        <Button size="sm" variant="ghost" disabled={busyId === r.id}
                          onClick={() => markNoShow(r.id)}>
                          <XCircle className="h-4 w-4 mr-1.5" /> No-show
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setSelected(r.id)}>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Templates preview */}
      <Card>
        <CardHeader>
          <CardTitle>Voorbeeldteksten</CardTitle>
          <CardDescription>Worden later via ClickWise verstuurd. Pas ze aan in instellingen.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TemplatePreview title="Reminder" body="We kijken uit naar je komst vandaag om {{time}}. Kun je toch niet komen? Laat het eenvoudig weten via je reserveringslink." />
          <TemplatePreview title="Herbevestiging" body="Kom je nog gezellig langs? Bevestig je reservering met één klik, dan houden we je tafel voor je vrij." />
          <TemplatePreview title="Annulering" body="Bedankt voor het doorgeven. We hebben je reservering geannuleerd en hopen je een andere keer te mogen ontvangen." />
          <TemplatePreview title="Reserveringsgarantie" body="Voor grotere groepen vragen we een kleine reserveringsgarantie, zodat we de tafel goed kunnen voorbereiden." />
        </CardContent>
      </Card>

      <ReservationDetailDialog
        reservationId={selected}
        open={!!selected}
        onOpenChange={(open) => { if (!open) { setSelected(null); refresh(); } }}
      />
    </div>
  );
};


const TemplatePreview = ({ title, body }: { title: string; body: string }) => (
  <div className="rounded-md border border-border bg-muted/30 p-3">
    <div className="text-xs font-medium text-muted-foreground mb-1">{title}</div>
    <div className="text-sm">{body}</div>
  </div>
);

export default NoShowPreventionPage;
