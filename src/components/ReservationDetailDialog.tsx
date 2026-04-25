import { useEffect, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelBadge } from "@/components/ChannelBadge";
import { toast } from "sonner";
import { reservations as resService, type ReservationStatus } from "@/services/reservations";
import { CheckCircle2, UserCheck, XCircle, AlertOctagon, ShieldCheck, ShieldX } from "lucide-react";
import { ReservationNoShowSection } from "@/components/no-show/ReservationNoShowSection";
import { ReservationPreOrderSection } from "@/components/pre-orders/ReservationPreOrderSection";
import { GuestPreviewInReservation } from "@/components/guests/GuestPreviewInReservation";
import { announceLastMinuteOpportunity } from "@/services/waitlist";
import { ReservationAftercareSection } from "@/components/reviews/ReservationAftercareSection";
import { createReviewRequestForReservation } from "@/services/reviews";

type Props = {
  reservationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ConfirmAction = null | {
  kind: "cancel" | "no_show";
  title: string;
  description: string;
  buttonLabel: string;
};

export function ReservationDetailDialog({ reservationId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  // deno-lint-ignore no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [restaurantCfg, setRestaurantCfg] = useState<{ large_group_threshold?: number; deposit_default_amount_cents?: number } | null>(null);
  const [form, setForm] = useState({
    party_size: 2,
    internal_notes: "",
    special_requests: "",
    reservation_date: "",
    start_time_local: "",
  });

  useEffect(() => {
    if (!open || !reservationId) return;
    setLoading(true);
    (async () => {
      const { data: r } = await supabase.from("reservations")
        .select("*, guests(*), reservation_tables(table_id, tables(label))")
        .eq("id", reservationId).maybeSingle();
      setData(r);
      if (r) {
        const start = new Date(r.start_time);
        setForm({
          party_size: r.party_size,
          internal_notes: r.internal_notes ?? "",
          special_requests: r.special_requests ?? "",
          reservation_date: r.reservation_date,
          start_time_local: format(start, "HH:mm"),
        });
        const { data: cfg } = await supabase.from("restaurants")
          .select("large_group_threshold, deposit_default_amount_cents")
          .eq("id", r.restaurant_id).maybeSingle();
        setRestaurantCfg(cfg);
      }
      setLoading(false);
    })();
  }, [open, reservationId]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["reservations-day"] });
    qc.invalidateQueries({ queryKey: ["today-reservations"] });
    qc.invalidateQueries({ queryKey: ["agenda-day"] });
  };

  const save = async () => {
    if (!reservationId || !data) return;
    setBusy(true);
    const result = await resService.update(reservationId, {
      reservation_date: form.reservation_date,
      start_time_local: form.start_time_local,
      party_size: form.party_size,
      internal_notes: form.internal_notes || null,
      special_requests: form.special_requests || null,
    });
    setBusy(false);
    if (!result.ok) return toast.error(result.error || "De reservering is niet opgeslagen.");
    toast.success("Reservering bijgewerkt");
    refresh();
    onOpenChange(false);
  };

  const runStatusAction = async (kind: "seated" | "completed" | "cancel" | "no_show") => {
    if (!reservationId) return;
    setBusy(true);
    let result;
    switch (kind) {
      case "seated":    result = await resService.markSeated(reservationId); break;
      case "completed": result = await resService.markCompleted(reservationId); break;
      case "cancel":    result = await resService.cancel(reservationId); break;
      case "no_show":   result = await resService.markNoShow(reservationId); break;
    }
    setBusy(false);
    if (!result.ok) return toast.error(result.error || "Actie mislukt.");
    const messages: Record<string, string> = {
      seated:    "Gast staat op 'aangekomen'.",
      completed: "Bezoek afgerond.",
      cancel:    "De reservering is geannuleerd. De tafel komt weer beschikbaar.",
      no_show:   "Gemarkeerd als no-show.",
    };
    toast.success(messages[kind]);
    // Surface a waitlist opportunity for freed slots
    if ((kind === "cancel" || kind === "no_show") && data) {
      announceLastMinuteOpportunity({
        restaurantId: data.restaurant_id,
        reservationId: reservationId,
        date: data.reservation_date,
        startTime: format(new Date(data.start_time), "HH:mm"),
        partySize: data.party_size,
        zoneId: data?.reservation_tables?.[0]?.tables?.zone_id ?? null,
        trigger: kind === "cancel" ? "cancellation" : "no_show",
      }).catch(() => { /* non-fatal */ });
      toast.info("Er zijn mogelijk wachtlijstgasten voor deze plek. Bekijk de wachtlijst.", {
        duration: 6000,
      });
    }
    refresh();
    onOpenChange(false);
  };

  const runLargeGroupDecision = async (kind: "approve" | "decline") => {
    if (!reservationId) return;
    setBusy(true);
    const result = kind === "approve"
      ? await resService.approveLargeGroup(reservationId)
      : await resService.declineLargeGroup(reservationId);
    setBusy(false);
    if (!result.ok) return toast.error(result.error || "Actie mislukt.");
    toast.success(kind === "approve"
      ? "Groepsreservering goedgekeurd."
      : "Groepsaanvraag afgewezen.");
    refresh();
    onOpenChange(false);
  };

  const askConfirm = (kind: "cancel" | "no_show") => {
    if (kind === "cancel") {
      setConfirm({
        kind, title: "Reservering annuleren?",
        description: "De tafel komt weer beschikbaar. Deze actie kan niet ongedaan gemaakt worden.",
        buttonLabel: "Ja, annuleren",
      });
    } else {
      setConfirm({
        kind, title: "Markeer als no-show?",
        description: "Dit wordt opgeslagen in de gastgeschiedenis.",
        buttonLabel: "Ja, markeren",
      });
    }
  };

  const status: ReservationStatus = data?.status;
  const canSeat = status === "confirmed" || status === "pending";
  const canComplete = status === "seated";
  const canNoShow = status === "confirmed" || status === "pending";
  const canCancel = ["pending", "confirmed", "seated", "hold"].includes(status);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Reservering</DialogTitle>
          </DialogHeader>
          {loading || !data ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Laden…</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={data.status} />
                <ChannelBadge channel={data.channel} />
                {data.requires_manual_approval && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    Goedkeuring nodig
                  </span>
                )}
                {data.confirmation_code && (
                  <span className="font-mono text-xs text-muted-foreground ml-auto">{data.confirmation_code}</span>
                )}
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <div className="font-medium">{data.guests?.first_name} {data.guests?.last_name ?? ""}</div>
                <div className="text-sm text-muted-foreground">{data.guests?.email}</div>
                {data.guests?.phone && <div className="text-sm text-muted-foreground">{data.guests.phone}</div>}
                {data.reservation_tables?.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Tafel: {data.reservation_tables.map((rt: { tables?: { label?: string } }) => rt.tables?.label).join(", ")}
                  </div>
                )}
              </div>

              {data.guest_id && (
                <GuestPreviewInReservation guestId={data.guest_id} />
              )}

              <ReservationNoShowSection
                reservation={data}
                largeGroupThreshold={restaurantCfg?.large_group_threshold}
                depositDefaultAmountCents={restaurantCfg?.deposit_default_amount_cents}
                onChanged={refresh}
              />

              <ReservationPreOrderSection
                reservationId={data.id}
                restaurantId={data.restaurant_id}
                partySize={data.party_size}
                occasion={data.occasion}
                largeGroupThreshold={restaurantCfg?.large_group_threshold}
                isVip={!!data.guests?.is_vip}
              />

              {(data.requires_manual_approval || data.large_group_status === "awaiting_approval") &&
                !["cancelled", "no_show", "completed"].includes(data.status) && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
                  <div className="text-sm font-medium text-warning flex items-center gap-1.5">
                    <ShieldX className="h-4 w-4" />
                    Groepsreservering wacht op jouw beoordeling
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.party_size} personen · Goedkeuren bevestigt de reservering, afwijzen annuleert hem.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => runLargeGroupDecision("decline")}>
                      <ShieldX className="h-4 w-4 mr-1" /> Afwijzen
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => runLargeGroupDecision("approve")}>
                      <ShieldCheck className="h-4 w-4 mr-1" /> Goedkeuren
                    </Button>
                  </div>
                </div>
              )}

              {/* Operator quick-actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary" size="lg" className="h-12 justify-start gap-2"
                  disabled={!canSeat || busy}
                  onClick={() => runStatusAction("seated")}
                >
                  <UserCheck className="h-4 w-4" /> Aangekomen
                </Button>
                <Button
                  variant="secondary" size="lg" className="h-12 justify-start gap-2"
                  disabled={!canComplete || busy}
                  onClick={() => runStatusAction("completed")}
                >
                  <CheckCircle2 className="h-4 w-4" /> Bezoek voltooid
                </Button>
                <Button
                  variant="outline" size="lg" className="h-12 justify-start gap-2"
                  disabled={!canNoShow || busy}
                  onClick={() => askConfirm("no_show")}
                >
                  <AlertOctagon className="h-4 w-4" /> Markeer no-show
                </Button>
                <Button
                  variant="outline" size="lg"
                  className="h-12 justify-start gap-2 text-destructive hover:text-destructive"
                  disabled={!canCancel || busy}
                  onClick={() => askConfirm("cancel")}
                >
                  <XCircle className="h-4 w-4" /> Annuleer
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Datum</Label>
                  <Input type="date" value={form.reservation_date}
                    onChange={(e) => setForm({ ...form, reservation_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tijd</Label>
                  <Input type="time" value={form.start_time_local}
                    onChange={(e) => setForm({ ...form, start_time_local: e.target.value })} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Personen</Label>
                  <Input type="number" min={1} value={form.party_size}
                    onChange={(e) => setForm({ ...form, party_size: parseInt(e.target.value) || 1 })} />
                </div>
              </div>

              {data.special_requests !== null && (
                <div className="space-y-1">
                  <Label className="text-xs">Wens van gast</Label>
                  <Textarea rows={2} value={form.special_requests}
                    onChange={(e) => setForm({ ...form, special_requests: e.target.value })} />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Interne notitie</Label>
                <Textarea rows={3} placeholder="Niet zichtbaar voor gast" value={form.internal_notes}
                  onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} />
              </div>

              <p className="text-xs text-muted-foreground">
                Aangemaakt {format(new Date(data.created_at), "d MMM yyyy HH:mm", { locale: nl })}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Sluiten</Button>
            <Button onClick={save} disabled={busy || loading}>
              {busy ? "Opslaan…" : "Wijzigingen opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Terug</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                runStatusAction(confirm.kind);
                setConfirm(null);
              }}
            >
              {confirm?.buttonLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
