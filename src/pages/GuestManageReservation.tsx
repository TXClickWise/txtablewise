import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
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
import { LanguageSwitcher } from "@/components/widget/LanguageSwitcher";
import { detectGuestLocale, persistGuestLocale, type Locale } from "@/lib/i18n/detectLocale";
import { setI18nLocale } from "@/lib/i18n";

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

const LOCALE_TAGS: Record<Locale, string> = {
  nl: "nl-NL", en: "en-GB", de: "de-DE", fr: "fr-FR",
};

export default function GuestManageReservation() {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const { t } = useTranslation("manage");

  const initialLocale = useMemo<Locale>(
    () => detectGuestLocale({ slug: `manage-${token ?? ""}`, urlLang: params.get("lang") }),
    [token, params],
  );
  const [locale, setLocale] = useState<Locale>(initialLocale);
  useEffect(() => { setI18nLocale(locale); }, [locale]);
  const handleLocaleChange = (next: Locale) => {
    setLocale(next);
    if (token) persistGuestLocale(`manage-${token}`, next);
    // Persist preference server-side so reminders/aftercare follow the guest's choice.
    fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "view", locale: next }),
    }).catch(() => { /* non-fatal */ });
  };

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantPublic | null>(null);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [showChange, setShowChange] = useState(false);
  const [changeForm, setChangeForm] = useState({
    desired_date: "", desired_time: "", desired_party_size: "",
    desired_first_name: "", desired_last_name: "", desired_email: "", desired_phone: "",
    desired_dietary_notes: "", message: "",
  });
  const [changeOutcome, setChangeOutcome] = useState<null | {
    outcome: "applied" | "rejected" | "pending_review";
    reason_code?: string | null;
  }>(null);

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, locale, ...extra }),
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
    return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: restaurant.timezone,
    }).format(d);
  }, [reservation, restaurant, locale]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !reservation || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 relative">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher value={locale} onChange={handleLocaleChange} />
        </div>
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="font-display">{t("notFoundTitle")}</CardTitle>
            <CardDescription>{t("notFound")}</CardDescription>
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
    if (!ok) return toast.error(t("toastConfirmFail"));
    setReservation(data.reservation);
    toast.success(t("toastConfirmSuccess"));
  };

  const onCancel = async () => {
    setActing(true);
    const { ok, data } = await call("cancel", { reason: cancelReason });
    setActing(false);
    setShowCancel(false);
    if (!ok) return toast.error(t("toastCancelFail"));
    setReservation(data.reservation);
    toast.success(t("toastCancelSuccess"));
  };

  const onSubmitChange = async () => {
    setActing(true);
    const { ok, data } = await call("request_change", {
      desired_date: changeForm.desired_date || undefined,
      desired_time: changeForm.desired_time || undefined,
      desired_party_size: changeForm.desired_party_size ? Number(changeForm.desired_party_size) : undefined,
      desired_first_name: changeForm.desired_first_name || undefined,
      desired_last_name: changeForm.desired_last_name || undefined,
      desired_email: changeForm.desired_email || undefined,
      desired_phone: changeForm.desired_phone || undefined,
      desired_dietary_notes: changeForm.desired_dietary_notes || undefined,
      message: changeForm.message || undefined,
    });
    setActing(false);
    setShowChange(false);
    if (!ok) return toast.error(t("toastChangeFail"));
    const outcome = (data?.outcome ?? "pending_review") as "applied" | "rejected" | "pending_review";
    setChangeOutcome({ outcome, reason_code: data?.reason_code ?? null });
    if (data?.reservation) setReservation(data.reservation);
    if (outcome === "applied") toast.success(t("toastChangeApplied"));
    else if (outcome === "rejected") toast.error(t("toastChangeRejected"));
    else toast.success(t("toastChangeSuccess"));
  };

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div className="text-center flex-1 space-y-1">
            <p className="text-sm text-muted-foreground">{restaurant.name}</p>
            <h1 className="font-display text-2xl">{t("title")}</h1>
          </div>
          <LanguageSwitcher value={locale} onChange={handleLocaleChange} />
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-display capitalize">{fmt}</CardTitle>
            <CardDescription className="flex flex-wrap gap-3 pt-2 text-sm">
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" />
                {t("guest", { count: reservation.party_size })}
              </span>
              {reservation.confirmation_code && (
                <span className="inline-flex items-center gap-1 font-mono text-xs">#{reservation.confirmation_code}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCancelled && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {t("cancelledBanner")}
              </div>
            )}
            {!isCancelled && reservation.reminder_confirmed_at && (
              <div className="rounded-md bg-primary/10 text-primary p-3 text-sm inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {t("attendanceConfirmed")}
              </div>
            )}
            {reservation.special_requests && (
              <div className="text-sm">
                <Label className="text-xs text-muted-foreground">{t("yourNote")}</Label>
                <p className="mt-1 whitespace-pre-wrap">{reservation.special_requests}</p>
              </div>
            )}

            {!isCancelled && !isPast && (
              <div className="grid sm:grid-cols-2 gap-2 pt-2">
                {!reservation.reminder_confirmed_at && (
                  <Button onClick={onConfirmAttendance} disabled={acting} className="gap-2">
                    <CalendarCheck2 className="h-4 w-4" /> {t("imComing")}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowChange(true)} disabled={acting} className="gap-2">
                  <Clock className="h-4 w-4" /> {t("requestChange")}
                </Button>
                <Button variant="ghost" onClick={() => setShowCancel(true)} disabled={acting} className="gap-2 text-destructive hover:text-destructive sm:col-span-2">
                  <CalendarX2 className="h-4 w-4" /> {t("cantMakeIt")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {changeOutcome && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">
                {changeOutcome.outcome === "applied"
                  ? t("changeAppliedTitle")
                  : changeOutcome.outcome === "rejected"
                  ? t("changeRejectedTitle")
                  : t("changeReceivedTitle")}
              </CardTitle>
              <CardDescription>
                {changeOutcome.outcome === "applied"
                  ? t("changeAppliedBody")
                  : changeOutcome.outcome === "rejected"
                  ? t(`changeRejectedReason.${changeOutcome.reason_code ?? "default"}`, { defaultValue: t("changeRejectedBody") })
                  : t("changeReceivedBody")}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">
          {restaurant.phone
            ? t("questionsFootWithPhone", { restaurant: restaurant.name, phone: restaurant.phone })
            : t("questionsFootNoPhone", { restaurant: restaurant.name })}
        </p>
      </div>

      {/* Cancel confirmation */}
      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cancelDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={t("cancelReasonPlaceholder")}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value.slice(0, 280))}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelKeep")}</AlertDialogCancel>
            <AlertDialogAction onClick={onCancel} disabled={acting}>{t("cancelConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change request */}
      <AlertDialog open={showChange} onOpenChange={setShowChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("changeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("changeDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("newDate")}</Label>
                <Input type="date" value={changeForm.desired_date} onChange={(e) => setChangeForm({ ...changeForm, desired_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("newTime")}</Label>
                <Input type="time" value={changeForm.desired_time} onChange={(e) => setChangeForm({ ...changeForm, desired_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("newPartySize")}</Label>
              <Input type="number" min={1} max={50} value={changeForm.desired_party_size} onChange={(e) => setChangeForm({ ...changeForm, desired_party_size: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("firstName")}</Label>
                <Input value={changeForm.desired_first_name} onChange={(e) => setChangeForm({ ...changeForm, desired_first_name: e.target.value.slice(0, 100) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("lastName")}</Label>
                <Input value={changeForm.desired_last_name} onChange={(e) => setChangeForm({ ...changeForm, desired_last_name: e.target.value.slice(0, 100) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("email")}</Label>
                <Input type="email" value={changeForm.desired_email} onChange={(e) => setChangeForm({ ...changeForm, desired_email: e.target.value.slice(0, 200) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("phone")}</Label>
                <Input type="tel" value={changeForm.desired_phone} onChange={(e) => setChangeForm({ ...changeForm, desired_phone: e.target.value.slice(0, 50) })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("dietaryNotes")}</Label>
              <Textarea rows={2} value={changeForm.desired_dietary_notes} onChange={(e) => setChangeForm({ ...changeForm, desired_dietary_notes: e.target.value.slice(0, 1000) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("note")}</Label>
              <Textarea value={changeForm.message} onChange={(e) => setChangeForm({ ...changeForm, message: e.target.value.slice(0, 500) })} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("back")}</AlertDialogCancel>
            <AlertDialogAction onClick={onSubmitChange} disabled={acting}>{t("submitChange")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
