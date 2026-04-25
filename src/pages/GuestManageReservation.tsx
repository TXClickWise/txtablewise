import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CalendarCheck2, CalendarX2, CheckCircle2, Clock, Loader2, Users } from "lucide-react";

type Reservation = {
  reservation_date: string;
  start_time: string;
  end_time: string;
  party_size: number;
  status: string;
  confirmation_code: string | null;
  reminder_confirmed_at: string | null;
  special_requests: string | null;
};
type RestaurantPublic = {
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  timezone: string;
};

const FUNCTION_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/guest_reservation`;

export default function GuestManageReservation() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantPublic | null>(null);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [showChange, setShowChange] = useState(false);
  const [changeForm, setChangeForm] = useState({ desired_date: "", desired_time: "", desired_party_size: "", message: "" });
  const [changeRequested, setChangeRequested] = useState(false);

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, ...extra }),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      setLoading(true);
      const { ok, data } = await call("view");
      if (cancelled) return;
      if (!ok) {
        setError(data?.error ?? "unknown");
      } else {
        setReservation(data.reservation);
        setRestaurant(data.restaurant);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fmt = useMemo(() => {
    if (!reservation || !restaurant) return null;
    const d = new Date(reservation.start_time);
    return new Intl.DateTimeFormat("nl-NL", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: restaurant.timezone,
    }).format(d);
  }, [reservation, restaurant]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !reservation || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="font-display">Link niet geldig</CardTitle>
            <CardDescription>
              Deze link is verlopen of niet (meer) geldig. Neem contact op met het restaurant als u uw reservering wilt bekijken of wijzigen.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isCancelled = reservation.status === "cancelled";
  const isPast = new Date(reservation.start_time) < new Date();

  const onConfirmAttendance = async () => {
    setActing(true);
    const { ok, data } = await call("confirm_attendance");
    setActing(false);
    if (!ok) return toast.error("Bevestigen lukt niet — probeer opnieuw");
    setReservation(data.reservation);
    toast.success("Fijn dat u komt — tot dan!");
  };

  const onCancel = async () => {
    setActing(true);
    const { ok, data } = await call("cancel", { reason: cancelReason });
    setActing(false);
    setShowCancel(false);
    if (!ok) return toast.error("Annuleren lukt niet — probeer opnieuw");
    setReservation(data.reservation);
    toast.success("Bedankt voor het laten weten — uw reservering is geannuleerd.");
  };

  const onSubmitChange = async () => {
    setActing(true);
    const { ok } = await call("request_change", {
      desired_date: changeForm.desired_date || undefined,
      desired_time: changeForm.desired_time || undefined,
      desired_party_size: changeForm.desired_party_size ? Number(changeForm.desired_party_size) : undefined,
      message: changeForm.message || undefined,
    });
    setActing(false);
    setShowChange(false);
    if (!ok) return toast.error("Verzenden lukt niet — probeer opnieuw");
    setChangeRequested(true);
    toast.success("Wijzigingsverzoek verstuurd — we nemen contact op.");
  };

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        <header className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">{restaurant.name}</p>
          <h1 className="font-display text-2xl">Uw reservering</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-display capitalize">{fmt}</CardTitle>
            <CardDescription className="flex flex-wrap gap-3 pt-2 text-sm">
              <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" />{reservation.party_size} {reservation.party_size === 1 ? "gast" : "gasten"}</span>
              {reservation.confirmation_code && (
                <span className="inline-flex items-center gap-1 font-mono text-xs">#{reservation.confirmation_code}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCancelled && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Deze reservering is geannuleerd.
              </div>
            )}
            {!isCancelled && reservation.reminder_confirmed_at && (
              <div className="rounded-md bg-primary/10 text-primary p-3 text-sm inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> U heeft aangegeven te komen — bedankt!
              </div>
            )}
            {reservation.special_requests && (
              <div className="text-sm">
                <Label className="text-xs text-muted-foreground">Uw opmerking</Label>
                <p className="mt-1 whitespace-pre-wrap">{reservation.special_requests}</p>
              </div>
            )}

            {!isCancelled && !isPast && (
              <div className="grid sm:grid-cols-2 gap-2 pt-2">
                {!reservation.reminder_confirmed_at && (
                  <Button onClick={onConfirmAttendance} disabled={acting} className="gap-2">
                    <CalendarCheck2 className="h-4 w-4" /> Ik kom
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowChange(true)} disabled={acting} className="gap-2">
                  <Clock className="h-4 w-4" /> Wijziging aanvragen
                </Button>
                <Button variant="ghost" onClick={() => setShowCancel(true)} disabled={acting} className="gap-2 text-destructive hover:text-destructive sm:col-span-2">
                  <CalendarX2 className="h-4 w-4" /> Ik kan toch niet komen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {changeRequested && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Wijzigingsverzoek ontvangen</CardTitle>
              <CardDescription>
                We nemen zo snel mogelijk contact met u op om de wijziging te bevestigen.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">
          Vragen? Bel of mail {restaurant.name}{restaurant.phone ? ` op ${restaurant.phone}` : ""}.
        </p>
      </div>

      {/* Cancel confirmation */}
      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reservering annuleren?</AlertDialogTitle>
            <AlertDialogDescription>
              Jammer dat u niet kunt komen. Wilt u eventueel een korte reden achterlaten?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Bijv. agenda gewijzigd (optioneel)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value.slice(0, 280))}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Toch niet</AlertDialogCancel>
            <AlertDialogAction onClick={onCancel} disabled={acting}>Bevestig annulering</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change request */}
      <AlertDialog open={showChange} onOpenChange={setShowChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wijziging aanvragen</AlertDialogTitle>
            <AlertDialogDescription>
              Geef hieronder uw voorkeur door. Wij bevestigen de wijziging persoonlijk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Nieuwe datum</Label>
                <Input type="date" value={changeForm.desired_date} onChange={(e) => setChangeForm({ ...changeForm, desired_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nieuwe tijd</Label>
                <Input type="time" value={changeForm.desired_time} onChange={(e) => setChangeForm({ ...changeForm, desired_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aantal gasten</Label>
              <Input type="number" min={1} max={50} value={changeForm.desired_party_size} onChange={(e) => setChangeForm({ ...changeForm, desired_party_size: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Opmerking</Label>
              <Textarea value={changeForm.message} onChange={(e) => setChangeForm({ ...changeForm, message: e.target.value.slice(0, 500) })} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={onSubmitChange} disabled={acting}>Verstuur verzoek</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
