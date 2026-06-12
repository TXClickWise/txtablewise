// Public booking widget — Guestplan-style 2-step flow.
//
// Steps: select (party + date + time on one screen) → details (contact + optional
//        preferences + extras + inline summary, single confirm tap) → confirmed.
// Sub-flows: waitlist + large_group reachable from the select step.
//
// Engine safety: all availability and reservation creation goes through the
// edge functions `availability` + `book_reservation`. The widget never invents
// its own slots; if the engine says full, we offer alternatives or the waitlist.
//
// Reachable via three URL aliases (App.tsx):
//   /r/:slug, /reserveer/:slug, /book/:slug
//
// Source channel: ?source=instagram_link|google_link|qr_code|external_platform.
// Unknown values fall back to "website_widget" and are kept in source_metadata.
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { nl, enGB, de, fr } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { detectGuestLocale, persistGuestLocale, type Locale } from "@/lib/i18n/detectLocale";
import { setI18nLocale } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/widget/LanguageSwitcher";
import {
  CalendarIcon, Users, Clock, ChevronRight, Check, ArrowLeft, MapPin, Heart, Sparkles, ListPlus, ChevronDown,
} from "lucide-react";

const DATE_FNS_LOCALES = { nl, en: enGB, de, fr } as const;
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { canAttemptBooking, recordBookingAttempt } from "@/lib/widgetRateLimit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  bookReservation, getAvailability, resolveSourceChannel,
  Slot, SelectedPreOrder, SourceChannel,
} from "@/services/publicBooking";
import { PublicBookingProgress, BookingStepId } from "@/components/public-booking/PublicBookingProgress";
import { PublicBookingNotice } from "@/components/public-booking/PublicBookingNotice";
import { PublicWaitlistFallback } from "@/components/public-booking/PublicWaitlistFallback";
import { PreOrderSelectionStep } from "@/components/public-booking/PreOrderSelectionStep";

type RestaurantInfo = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  max_party_size_online: number;
  large_group_threshold: number;
  large_group_manual_approval_from: number | null;
  large_group_extra_info_from: number | null;
  large_group_max_online_request: number | null;
  extra_large_group_threshold: number | null;
  large_group_confirmation_text: string | null;
  preorders_enabled: boolean;
  preorders_allow_free_text: boolean;
  allow_zone_preference: boolean;
  brand_primary: string | null;
  logo_url: string | null;
  booking_horizon_days: number;
};

// Convert #RRGGBB hex to "h s% l%" string for CSS HSL custom properties.
function hexToHslTokens(hex: string): string | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const makeGuestSchema = (t: (k: string) => string) => z.object({
  first_name: z.string().trim().min(1, t("errors.firstNameRequired")).max(80),
  last_name: z.string().trim().max(80).optional(),
  email: z.string().trim().min(1, t("errors.emailRequired")).email(t("errors.emailInvalid")).max(255),
  phone: z.string().trim().min(6, t("errors.phoneRequired")).max(40),
});

type Step = BookingStepId | "large_group" | "waitlist";

const ZONE_IDS = ["no_pref", "indoor", "terrace"] as const;
const OCCASION_IDS = ["", "birthday", "anniversary", "business", "date_night", "other"] as const;

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "px-4 h-10 rounded-full border text-sm font-medium transition-all touch-manipulation active:scale-95",
      active
        ? "border-primary bg-primary text-primary-foreground shadow-sm"
        : "border-border bg-card text-foreground hover:border-primary/40",
    )}
  >
    {children}
  </button>
);

const ReserveWidget = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation("widget");
  const sourceInfo = useMemo(
    () => resolveSourceChannel(searchParams.get("source")),
    [searchParams],
  );

  // Locale state — auto-detect, persistable, mirrors into i18next + date-fns
  const initialLocale = useMemo<Locale>(
    () => detectGuestLocale({ slug, urlLang: searchParams.get("lang") }),
    [slug, searchParams],
  );
  const [locale, setLocale] = useState<Locale>(initialLocale);
  useEffect(() => { setI18nLocale(locale); }, [locale]);
  const dfLocale = DATE_FNS_LOCALES[locale];
  const ZONES = useMemo(
    () => ZONE_IDS.map((id) => ({ id, label: t(`zones.${id}`) })),
    [t, locale],
  );
  const OCCASIONS = useMemo(
    () => OCCASION_IDS.map((id) => ({ id, label: id === "" ? t("occasions.none") : t(`occasions.${id}`) })),
    [t, locale],
  );
  const guestSchema = useMemo(() => makeGuestSchema((k) => t(`errors.${k.replace("errors.", "")}`)), [t, locale]);
  const handleLocaleChange = (next: Locale) => {
    setLocale(next);
    if (slug) persistGuestLocale(slug, next);
  };

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [step, setStep] = useState<Step>("select");

  // URL prefill helpers
  const initialParty = useMemo(() => {
    const v = parseInt(searchParams.get("party") ?? "", 10);
    return !Number.isNaN(v) && v >= 1 && v <= 50 ? v : 2;
  }, [searchParams]);
  const initialDate = useMemo(() => {
    const raw = searchParams.get("date");
    if (raw) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return today;
  }, [searchParams]);
  const initialTime = useMemo(() => {
    const raw = searchParams.get("time");
    return raw && /^\d{1,2}:\d{2}$/.test(raw) ? raw : null;
  }, [searchParams]);
  const hideTableWiseLogo = searchParams.get("hide_logo") === "1";
  const accentOverride = useMemo(() => {
    const raw = searchParams.get("accent");
    if (!raw) return null;
    const hex = raw.startsWith("#") ? raw : `#${raw}`;
    return hexToHslTokens(hex);
  }, [searchParams]);

  // Booking state
  const [partySize, setPartySize] = useState<number>(initialParty);
  const [date, setDate] = useState<Date | undefined>(initialDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Preferences
  const [zone, setZone] = useState<string>("no_pref");
  const [occasion, setOccasion] = useState<string>("");
  const [allergies, setAllergies] = useState("");
  const [requests, setRequests] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [showPreOrders, setShowPreOrders] = useState(false);

  // Pre-orders
  const [preOrders, setPreOrders] = useState<SelectedPreOrder[]>([]);

  // Guest fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [marketing, setMarketing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ code: string; start: string; status: string } | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [dbZones, setDbZones] = useState<{ id: string; name: string }[]>([]);

  // Load restaurant
  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, slug, timezone, max_party_size_online, large_group_threshold, large_group_manual_approval_from, large_group_extra_info_from, large_group_max_online_request, extra_large_group_threshold, large_group_confirmation_text, preorders_enabled, preorders_allow_free_text, allow_zone_preference, brand_primary, logo_url, booking_horizon_days")
        .eq("slug", slug).maybeSingle();
      if (error || !data) {
        setRestaurantError(t("errors.unavailable"));
        return;
      }
      setRestaurant(data as RestaurantInfo);
      const { data: zonesData } = await supabase
        .from("zones")
        .select("id, name")
        .eq("restaurant_id", data.id)
        .eq("is_active", true)
        .eq("bookable_online", true)
        .order("sort_order");
      setDbZones((zonesData ?? []) as { id: string; name: string }[]);
    })();
  }, [slug]);

  // Resolve effective brand color (URL override wins)
  const brandHsl = useMemo(() => {
    if (accentOverride) return accentOverride;
    if (restaurant?.brand_primary) return hexToHslTokens(restaurant.brand_primary);
    return null;
  }, [accentOverride, restaurant?.brand_primary]);

  const fetchSlots = async () => {
    if (!restaurant || !date) return;
    setLoadingSlots(true);
    setSlots([]);
    setClosedReason(null);
    setSelectedSlot(null);
    try {
      const data = await getAvailability({
        restaurant_id: restaurant.id,
        date: format(date, "yyyy-MM-dd"),
        party_size: partySize,
      });
      if (data.large_group) {
        setStep("large_group");
        return;
      }
      if (data.closed) {
        setClosedReason(data.message ?? t("closedOnDay"));
      }
      setSlots(data.slots ?? []);
    } catch (e) {
      toast.error(t("errors.availabilityFailed"));
    } finally {
      setLoadingSlots(false);
    }
  };

  // Refetch on select-step whenever party/date change
  useEffect(() => {
    if (step === "select" && restaurant && date) fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, partySize, date, restaurant?.id]);

  // Preselect slot from URL when slots load
  useEffect(() => {
    if (!initialTime || step !== "select" || selectedSlot) return;
    const match = slots.find((s) => s.time === initialTime || s.time.startsWith(initialTime));
    if (match && match.available) setSelectedSlot(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, step, initialTime]);

  const maxOnlineRequest = restaurant
    ? (restaurant.large_group_max_online_request ?? restaurant.max_party_size_online)
    : 0;
  const extraInfoFrom = restaurant?.large_group_extra_info_from ?? null;
  const manualApprovalFrom = restaurant?.large_group_manual_approval_from ?? null;
  const xlFrom = restaurant?.extra_large_group_threshold ?? null;
  const requiresMessage = !!extraInfoFrom && partySize >= extraInfoFrom;
  const showsApprovalBanner =
    (!!manualApprovalFrom && partySize >= manualApprovalFrom) ||
    (!!xlFrom && partySize >= xlFrom);

  const goToDetails = () => {
    if (!restaurant) return;
    if (partySize > maxOnlineRequest) {
      setStep("large_group");
      return;
    }
    if (!date) return toast.error(t("errors.chooseDate"));
    if (!selectedSlot) return toast.error(t("errors.chooseTime"));
    if (requiresMessage) setShowExtras(true);
    setStep("details");
  };

  const handleBook = async () => {
    if (!restaurant || !selectedSlot || !date) return;
    const parsed = guestSchema.safeParse({ first_name: firstName, last_name: lastName, email, phone });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    if (requiresMessage && !requests.trim()) {
      setShowExtras(true);
      return toast.error(t("errors.messageRequired"));
    }

    const gate = canAttemptBooking();
    if (!gate.allowed) {
      const mins = Math.ceil((gate.retryInSeconds ?? 60) / 60);
      toast.error(t("errors.rateLimitTitle"), {
        description: t("errors.rateLimitBody", { minutes: mins, plural: mins === 1 ? "" : (locale === "nl" ? "ten" : locale === "de" ? "n" : "s") }),
      });
      return;
    }
    recordBookingAttempt();

    setBookingError(null);
    setSubmitting(true);

    const combinedRequests = [
      requests.trim(),
      allergies.trim() ? `Allergieën/dieet: ${allergies.trim()}` : "",
      zone !== "no_pref" ? `Zonevoorkeur: ${ZONES.find((z) => z.id === zone)?.label}` : "",
    ].filter(Boolean).join("\n");

    const result = await bookReservation(
      {
        restaurant_id: restaurant.id,
        date: format(date, "yyyy-MM-dd"),
        time: selectedSlot.time,
        party_size: partySize,
        guest: {
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name,
          email: parsed.data.email || undefined,
          phone: parsed.data.phone,
          language: locale,
        },
        special_requests: combinedRequests || undefined,
        dietary_notes: allergies.trim() || undefined,
        occasion: occasion || undefined,
        marketing_consent: marketing,
        source_channel: sourceInfo.source_channel,
        source_metadata: sourceInfo.raw_source ? { raw_source: sourceInfo.raw_source } : undefined,
      },
      preOrders,
    );
    setSubmitting(false);

    if (result.ok === false) {
      setBookingError(result.error);
      if (result.retry) {
        // Slot was just taken — refresh and bring user back to select step
        await fetchSlots();
        setStep("select");
      }
      return;
    }
    setConfirmation({
      code: result.reservation.confirmation_code,
      start: result.reservation.start_time,
      status: result.reservation.status,
    });
    setStep("confirmed");
  };

  const partyOptions = useMemo(() => {
    const max = Math.max(1, restaurant?.max_party_size_online ?? 8);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [restaurant]);
  const canRequestLargerOnline = !!restaurant && maxOnlineRequest > (restaurant.max_party_size_online ?? 0);

  if (restaurantError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-2">
          <p className="text-foreground font-medium">{restaurantError}</p>
        </div>
      </div>
    );
  }
  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t("errors.loading")}</div>
      </div>
    );
  }

  const showProgress = !["confirmed", "large_group", "waitlist"].includes(step);

  const reset = () => {
    setStep("select"); setConfirmation(null); setSelectedSlot(null);
    setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setRequests(""); setAllergies("");
    setMarketing(false); setOccasion(""); setZone("no_pref"); setPreOrders([]); setBookingError(null);
    setShowExtras(false); setShowPreOrders(false);
  };

  return (
    <div
      className="min-h-screen bg-background"
      style={brandHsl ? ({ ["--primary" as any]: brandHsl, ["--ring" as any]: brandHsl } as React.CSSProperties) : undefined}
    >
      <Helmet>
        <title>{`Reserveer bij ${restaurant.name} — TX TableWise`}</title>
        <meta
          name="description"
          content={`Reserveer online een tafel bij ${restaurant.name}. Snel, eenvoudig en bevestigd binnen enkele seconden.`}
        />
        <link rel="canonical" href={`https://txtablewise.nl/r/${restaurant.slug}`} />
        <meta property="og:title" content={`Reserveer bij ${restaurant.name}`} />
        <meta
          property="og:description"
          content={`Reserveer online een tafel bij ${restaurant.name} via TX TableWise.`}
        />
        <meta property="og:url" content={`https://txtablewise.nl/r/${restaurant.slug}`} />
        <meta property="og:type" content="website" />
        {restaurant.logo_url ? (
          <meta property="og:image" content={restaurant.logo_url} />
        ) : null}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Restaurant",
            name: restaurant.name,
            url: `https://txtablewise.nl/r/${restaurant.slug}`,
            ...(restaurant.logo_url ? { image: restaurant.logo_url, logo: restaurant.logo_url } : {}),
            acceptsReservations: true,
          })}
        </script>
      </Helmet>
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt={`${restaurant.name} logo`} className="h-8 w-auto object-contain" />
            ) : null}
            <span className="font-display text-base sm:text-lg truncate">{restaurant.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher value={locale} onChange={handleLocaleChange} />
            {!hideTableWiseLogo && (
              <Link to="/" className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap hidden sm:inline">
                powered by <span className="font-display text-primary">TX TableWise</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {showProgress && (
          <div className="mb-6">
            <PublicBookingProgress current={step as BookingStepId} />
          </div>
        )}

        {/* STEP 1: select (party + date + time) */}
        {step === "select" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl mb-2">{t("title")}</h1>
              <p className="text-muted-foreground">{t("atRestaurant", { name: restaurant.name })}</p>
            </div>

            {/* Party size */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> {t("party")}
              </Label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {partyOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPartySize(n)}
                    className={cn(
                      "h-12 rounded-lg border-2 font-medium text-base transition-all touch-manipulation active:scale-95",
                      partySize === n
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {canRequestLargerOnline && (
                <div className="flex items-center gap-2 pt-1">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">{t("largerGroup")}</Label>
                  <Input
                    type="number"
                    min={(restaurant?.max_party_size_online ?? 0) + 1}
                    max={200}
                    value={partySize > (restaurant?.max_party_size_online ?? 0) ? partySize : ""}
                    placeholder={t("largerGroupPlaceholder", { n: maxOnlineRequest })}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v) && v >= 1) setPartySize(Math.min(v, 200));
                    }}
                    className="h-10 max-w-[10rem]"
                  />
                </div>
              )}
              {showsApprovalBanner && partySize <= maxOnlineRequest && (
                <p className="text-xs text-muted-foreground">
                  {restaurant?.large_group_confirmation_text?.trim() ||
                    t("manualApprovalDefault", { n: manualApprovalFrom, restaurant: restaurant?.name })}
                </p>
              )}
              {restaurant && partySize > maxOnlineRequest && (
                <p className="text-xs text-muted-foreground">
                  {t("largerGroupRedirect", { n: maxOnlineRequest + 1, restaurant: restaurant.name })}
                </p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" /> {t("date")}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t("today"), offset: 0 },
                  { label: t("tomorrow"), offset: 1 },
                  { label: t("dayAfter"), offset: 2 },
                ].map((q) => {
                  const d = new Date(); d.setDate(d.getDate() + q.offset); d.setHours(0, 0, 0, 0);
                  const sel = date && format(date, "yyyy-MM-dd") === format(d, "yyyy-MM-dd");
                  return (
                    <button key={q.label} type="button" onClick={() => setDate(d)}
                      className={cn(
                        "h-12 rounded-lg border-2 font-medium text-sm transition-all active:scale-95 touch-manipulation",
                        sel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40",
                      )}>
                      {q.label}
                    </button>
                  );
                })}
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-12 justify-start text-base font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "EEEE d MMMM yyyy", { locale: dfLocale }) : t("chooseDate")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus locale={dfLocale}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || d > new Date(Date.now() + (restaurant.booking_horizon_days ?? 30) * 24 * 60 * 60 * 1000)}
                    className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time slots */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> {t("time")}
              </Label>
              {loadingSlots ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : closedReason ? (
                <Card>
                  <CardContent className="py-6 text-center space-y-3">
                    <Clock className="h-7 w-7 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{closedReason}</p>
                  </CardContent>
                </Card>
              ) : slots.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">{t("noSlots")}</p>
                    <Button size="sm" variant="outline" onClick={() => setStep("waitlist")}>
                      {t("joinWaitlist")}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.start_iso}
                        disabled={!s.available}
                        onClick={() => setSelectedSlot(s)}
                        className={cn(
                          "h-12 rounded-lg border-2 font-medium text-sm transition-all touch-manipulation active:scale-95",
                          selectedSlot?.start_iso === s.start_iso
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : s.available
                              ? "border-border bg-card hover:border-primary hover:bg-primary/5"
                              : "border-border/40 bg-muted text-muted-foreground/50 cursor-not-allowed",
                          s.available && s.peak_warning && selectedSlot?.start_iso !== s.start_iso && "ring-1 ring-warning/40",
                        )}
                        title={!s.available ? t("slotFull") : s.peak_warning ? t("slotLimited") : t("slotAvailable")}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                  {slots.every((s) => !s.available) && (
                    <PublicBookingNotice variant="warning" title={t("fullTitle")}>
                      <div className="space-y-3">
                        <p>{t("fullBody")}</p>
                        <Button size="sm" onClick={() => setStep("waitlist")}>{t("joinWaitlist")}</Button>
                      </div>
                    </PublicBookingNotice>
                  )}
                </>
              )}
            </div>

            <Button
              className="w-full h-14 text-base"
              onClick={goToDetails}
              disabled={!selectedSlot || !date || loadingSlots}
            >
              {t("bookTable")} <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP 2: details (contact + optional preferences/extras + confirm) */}
        {step === "details" && selectedSlot && date && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <button onClick={() => setStep("select")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> {t("changeTime")}
            </button>

            {/* Compact summary chips */}
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="px-3 h-9 inline-flex items-center rounded-full bg-muted font-medium">
                {t("guest", { count: partySize })}
              </span>
              <span className="px-3 h-9 inline-flex items-center rounded-full bg-muted font-medium">
                {format(date, "EEE d MMM", { locale: dfLocale })}
              </span>
              <span className="px-3 h-9 inline-flex items-center rounded-full bg-primary/10 text-primary font-semibold">
                {selectedSlot.time}
              </span>
            </div>

            <div>
              <h2 className="font-display text-2xl mb-1">{t("yourDetails")}</h2>
              <p className="text-sm text-muted-foreground">{t("yourDetailsSub")}</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fn">{t("firstName")} *</Label>
                  <Input id="fn" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-12" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ln">{t("lastName")}</Label>
                  <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-12" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ph">{t("phone")} *</Label>
                <Input id="ph" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12" placeholder={t("phonePlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em">{t("email")} *</Label>
                <Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
              </div>
            </div>

            {/* Optional preferences (collapsible) */}
            <Collapsible open={showExtras} onOpenChange={setShowExtras}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm text-primary hover:underline">
                <span className="flex items-center gap-2">
                  <Heart className="h-4 w-4" /> {t("addPreferences")}
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showExtras && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {restaurant.allow_zone_preference && (dbZones.length >= 2 || dbZones.length === 0) && (
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> {t("zoneQ")}</Label>
                    <div className="flex flex-wrap gap-2">
                      <Chip active={zone === "no_pref"} onClick={() => setZone("no_pref")}>{t("zones.no_pref")}</Chip>
                      {dbZones.length >= 2
                        ? dbZones.map((z) => (
                            <Chip key={z.id} active={zone === z.id} onClick={() => setZone(z.id)}>{z.name}</Chip>
                          ))
                        : ZONES.filter((z) => z.id !== "no_pref").map((z) => (
                            <Chip key={z.id} active={zone === z.id} onClick={() => setZone(z.id)}>{z.label}</Chip>
                          ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm">{t("occasionQ")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {OCCASIONS.map((o) => (
                      <Chip key={o.id} active={occasion === o.id} onClick={() => setOccasion(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="all">{t("allergies")}</Label>
                  <Input id="all" value={allergies} onChange={(e) => setAllergies(e.target.value)} className="h-12"
                    placeholder={t("allergiesPlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rq">
                    {requiresMessage ? `${t("requestsRequired")} *` : t("requests")}
                  </Label>
                  <Textarea id="rq" value={requests} onChange={(e) => setRequests(e.target.value)} rows={3}
                    placeholder={requiresMessage ? t("requestsRequiredPlaceholder") : t("requestsPlaceholder")} />
                  {requiresMessage && (
                    <p className="text-xs text-muted-foreground">
                      {t("requestsHint", { n: extraInfoFrom })}
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Optional pre-orders (collapsible) */}
            {restaurant.preorders_enabled && (
              <Collapsible open={showPreOrders} onOpenChange={setShowPreOrders}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-sm text-primary hover:underline">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> {t("preOrders")}
                    {preOrders.length > 0 && (
                      <span className="text-xs text-muted-foreground">({preOrders.length})</span>
                    )}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showPreOrders && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <PreOrderSelectionStep
                    restaurantId={restaurant.id}
                    allowFreeText={restaurant.preorders_allow_free_text}
                    selected={preOrders}
                    onChange={setPreOrders}
                  />
                </CollapsibleContent>
              </Collapsible>
            )}

            {preOrders.length > 0 && !showPreOrders && (
              <Card>
                <CardContent className="py-3 text-sm">
                  <div className="text-muted-foreground mb-1 flex items-center gap-1">
                    <ListPlus className="h-3.5 w-3.5" /> {t("preOrdersSummary")}
                  </div>
                  <ul className="space-y-1">
                    {preOrders.map((p, i) => (
                      <li key={i} className="flex justify-between">
                        <span>{p.quantity}× {p.item_name}</span>
                        {p.unit_price_cents > 0 && (
                          <span className="text-muted-foreground">€ {((p.unit_price_cents * p.quantity) / 100).toFixed(2)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(!!v)} className="mt-1" />
              <span className="text-sm text-muted-foreground">
                {t("marketing", { restaurant: restaurant.name })}
              </span>
            </label>

            {bookingError && (
              <PublicBookingNotice variant="error" title={t("somethingWrong")}>{bookingError}</PublicBookingNotice>
            )}

            <Button className="w-full h-14 text-base" onClick={handleBook} disabled={submitting}>
              {submitting ? t("checkingAvailability") : t("confirm")}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {t("termsLine")}
            </p>
          </div>
        )}

        {/* STEP: confirmed */}
        {step === "confirmed" && confirmation && date && (
          <div className="space-y-6 animate-in fade-in duration-300 text-center py-8">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl mb-2">
                {confirmation.status === "pending" ? t("confirmedPendingTitle") : t("confirmedTitle")}
              </h1>
              <p className="text-muted-foreground">
                {confirmation.status === "pending"
                  ? t("confirmedPendingSub", { restaurant: restaurant.name })
                  : t("confirmedActiveSub", { restaurant: restaurant.name })}
              </p>
            </div>
            <Card className="text-left">
              <CardContent className="py-5 space-y-3">
                <Row label={t("rowDateTime")} value={format(new Date(confirmation.start), "EEE d MMM · HH:mm", { locale: dfLocale })} />
                <Row label={t("rowGuests")} value={String(partySize)} />
                <Row label={t("rowCode")} value={confirmation.code} mono />
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
              {t("channelHint")}
            </p>
            <Button variant="outline" onClick={reset}>{t("newReservation")}</Button>
          </div>
        )}

        {/* SUB-FLOW: large group */}
        {step === "large_group" && (
          <LargeGroupForm
            restaurant={restaurant}
            initialPartySize={Math.max(restaurant.large_group_threshold, partySize)}
            initialDate={date}
            sourceChannel={sourceInfo.source_channel}
            onBack={() => setStep("select")}
          />
        )}

        {/* SUB-FLOW: waitlist */}
        {step === "waitlist" && date && (
          <PublicWaitlistFallback
            restaurantId={restaurant.id}
            restaurantName={restaurant.name}
            date={date}
            partySize={partySize}
            initialFirstName={firstName}
            initialLastName={lastName}
            initialEmail={email}
            initialPhone={phone}
            sourceChannel={sourceInfo.source_channel}
            onBack={() => setStep("select")}
          />
        )}
      </main>
    </div>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex justify-between gap-4">
    <span className="text-muted-foreground">{label}</span>
    <span className={cn("font-medium text-right", mono && "font-mono tracking-wider")}>{value}</span>
  </div>
);

// ---------- Large Group sub-form ----------
const LargeGroupForm = ({
  restaurant, initialPartySize, initialDate, sourceChannel, onBack,
}: {
  restaurant: RestaurantInfo;
  initialPartySize: number;
  initialDate?: Date;
  sourceChannel: SourceChannel;
  onBack: () => void;
}) => {
  const { t, i18n } = useTranslation("widget");
  const currentLocale = (i18n.language as Locale) || "nl";
  const dfLocale = DATE_FNS_LOCALES[currentLocale] ?? nl;
  const [name, setName] = useState("");
  const [emailV, setEmailV] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(initialPartySize);
  const [date, setDate] = useState<Date | undefined>(initialDate);
  const [time, setTime] = useState("");
  const [occasion, setOccasion] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !emailV.trim() || !partySize) return toast.error(t("errors.fillRequired"));
    setSubmitting(true);
    const { error } = await supabase.from("large_group_requests").insert({
      restaurant_id: restaurant.id,
      contact_name: name.trim(),
      contact_email: emailV.trim(),
      contact_phone: phone.trim() || null,
      party_size: partySize,
      preferred_date: date ? format(date, "yyyy-MM-dd") : null,
      preferred_time: time || null,
      occasion: occasion || null,
      message: message ? `${message}\n\n[bron: ${sourceChannel}]` : `[bron: ${sourceChannel}]`,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setDone(true);
  };

  if (done) {
    return (
      <div className="space-y-6 text-center py-8 animate-in fade-in duration-300">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-3xl">{t("group.receivedHeading")}</h1>
        <p className="text-muted-foreground">
          {t("group.receivedBody", { restaurant: restaurant.name })}
        </p>
        <Button variant="outline" onClick={onBack}>{t("back")}</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 animate-in fade-in duration-300">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </button>
      <div>
        <h1 className="font-display text-3xl mb-2">{t("group.heading")}</h1>
        <p className="text-muted-foreground">
          {t("group.intro", { n: restaurant.large_group_threshold })}
        </p>
      </div>

      <PublicBookingNotice>
        {t("group.notice")}
      </PublicBookingNotice>

      <div className="space-y-1.5">
        <Label>{t("group.personsLabel")} *</Label>
        <Input type="number" min={restaurant.large_group_threshold} max={200} required
          value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className="h-12" />
      </div>
      <div className="space-y-1.5">
        <Label>{t("group.nameLabel")} *</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("group.emailLabel")} *</Label>
          <Input type="email" required value={emailV} onChange={(e) => setEmailV(e.target.value)} className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("group.phoneLabel")}</Label>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("group.dateLabel")}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-12 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "d MMM yyyy", { locale: dfLocale }) : t("group.datePlaceholder")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} locale={dfLocale}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                className={cn("p-3 pointer-events-auto")} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label>{t("group.timeLabel")}</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-12" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("group.occasionLabel")}</Label>
        <Input value={occasion} onChange={(e) => setOccasion(e.target.value)} className="h-12"
          placeholder={t("group.occasionPlaceholder")} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("group.messageLabel")}</Label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
          placeholder={t("group.messagePlaceholder")} />
      </div>

      <Button type="submit" className="w-full h-14 text-base" disabled={submitting}>
        {submitting ? t("group.submitting") : t("group.submit")}
      </Button>
    </form>
  );
};

export default ReserveWidget;
