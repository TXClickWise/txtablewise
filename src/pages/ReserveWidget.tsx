// Public booking widget — mobile-first multi-step reservation flow.
//
// Steps: party → date → time → preferences → extras → guest → review → confirmed
//        (waitlist + large_group are dedicated sub-flows reachable from the slot step)
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
import { useParams, useSearchParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  CalendarIcon, Users, Clock, ChevronRight, Check, ArrowLeft, MapPin, Heart, Sparkles, ListPlus,
} from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  bookReservation, getAvailability, pickAlternatives, resolveSourceChannel,
  Slot, SelectedPreOrder, SourceChannel,
} from "@/services/publicBooking";
import { PublicBookingProgress, BookingStepId } from "@/components/public-booking/PublicBookingProgress";
import { PublicBookingNotice } from "@/components/public-booking/PublicBookingNotice";
import { PublicAlternativeTimes } from "@/components/public-booking/PublicAlternativeTimes";
import { PublicWaitlistFallback } from "@/components/public-booking/PublicWaitlistFallback";
import { PreOrderSelectionStep } from "@/components/public-booking/PreOrderSelectionStep";

type RestaurantInfo = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  max_party_size_online: number;
  large_group_threshold: number;
  preorders_enabled: boolean;
  preorders_allow_free_text: boolean;
  allow_zone_preference: boolean;
  brand_primary: string | null;
  logo_url: string | null;
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

const guestSchema = z.object({
  first_name: z.string().trim().min(1, "Voornaam is verplicht").max(80),
  last_name: z.string().trim().max(80).optional(),
  email: z.string().trim().email("Geldig e-mailadres vereist").max(255).optional().or(z.literal("")),
  phone: z.string().trim().min(6, "Telefoonnummer is verplicht").max(40),
});

type Step = BookingStepId | "large_group" | "waitlist";

const ZONES = [
  { id: "no_pref", label: "Geen voorkeur" },
  { id: "indoor", label: "Binnen" },
  { id: "terrace", label: "Terras" },
] as const;

const OCCASIONS = [
  { id: "", label: "Geen" },
  { id: "birthday", label: "Verjaardag" },
  { id: "anniversary", label: "Jubileum" },
  { id: "business", label: "Zakelijk" },
  { id: "date_night", label: "Date night" },
  { id: "other", label: "Anders" },
] as const;

const PartyButton = ({ n, selected, onClick, label }: { n: number; selected: boolean; onClick: () => void; label?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "h-14 rounded-lg border-2 font-medium text-base transition-all touch-manipulation active:scale-95",
      selected
        ? "border-primary bg-primary text-primary-foreground shadow-md"
        : "border-border bg-card hover:border-primary/40",
    )}
  >
    {label ?? n}
  </button>
);

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
  const sourceInfo = useMemo(
    () => resolveSourceChannel(searchParams.get("source")),
    [searchParams],
  );

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [step, setStep] = useState<Step>("party");

  // URL prefill helpers
  const initialParty = useMemo(() => {
    const v = parseInt(searchParams.get("party") ?? "", 10);
    return !Number.isNaN(v) && v >= 1 && v <= 50 ? v : 2;
  }, [searchParams]);
  const initialDate = useMemo(() => {
    const raw = searchParams.get("date");
    if (!raw) return undefined;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
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
  const [customParty, setCustomParty] = useState<string>("");
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

  // Load restaurant
  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, slug, timezone, max_party_size_online, large_group_threshold, preorders_enabled, preorders_allow_free_text, allow_zone_preference, brand_primary, logo_url")
        .eq("slug", slug).maybeSingle();
      if (error || !data) {
        toast.error("Restaurant niet gevonden");
        return;
      }
      setRestaurant(data as RestaurantInfo);
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
        setClosedReason(data.message ?? "Gesloten op deze dag.");
      }
      setSlots(data.slots ?? []);
    } catch (e) {
      toast.error("Er ging iets mis bij het controleren van de beschikbaarheid.");
    } finally {
      setLoadingSlots(false);
    }
  };

  // Refetch when entering time step or when party/date change while on it
  useEffect(() => {
    if (step === "time") fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, partySize, date]);

  // Preselect slot from URL when slots load
  useEffect(() => {
    if (!initialTime || step !== "time" || selectedSlot) return;
    const match = slots.find((s) => s.time === initialTime || s.time.startsWith(initialTime));
    if (match) setSelectedSlot(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, step, initialTime]);

  // Auto-route to large group if party crosses online max
  const goToTimeFromDate = () => {
    if (!date) return toast.error("Kies een datum");
    if (restaurant && partySize > restaurant.max_party_size_online) {
      setStep("large_group");
      return;
    }
    setStep("time");
  };

  const handleBook = async () => {
    if (!restaurant || !selectedSlot || !date) return;
    const parsed = guestSchema.safeParse({ first_name: firstName, last_name: lastName, email, phone });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);

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
          language: "nl",
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
        // Slot was just taken — refresh and bring user back to time step
        await fetchSlots();
        setSelectedSlot(null);
        setStep("time");
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
    const max = Math.min(5, restaurant?.max_party_size_online ?? 5);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [restaurant]);

  const alternatives = useMemo(
    () => (selectedSlot ? pickAlternatives(slots, selectedSlot.time) : []),
    [slots, selectedSlot],
  );

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Laden…</div>
      </div>
    );
  }

  const showProgress = !["confirmed", "large_group", "waitlist"].includes(step);

  const reset = () => {
    setStep("party"); setConfirmation(null); setSelectedSlot(null);
    setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setRequests(""); setAllergies("");
    setMarketing(false); setOccasion(""); setZone("no_pref"); setPreOrders([]); setBookingError(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-display text-lg text-primary">TableWise</Link>
          <span className="text-sm text-muted-foreground truncate ml-3">{restaurant.name}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {showProgress && (
          <div className="mb-6">
            <PublicBookingProgress current={step as BookingStepId} />
          </div>
        )}

        {/* STEP: party */}
        {step === "party" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl mb-2">Reserveer een tafel</h1>
              <p className="text-muted-foreground">Bij {restaurant.name}.</p>
            </div>

            <div className="space-y-3">
              <Label className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Met hoeveel personen wil je reserveren?
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {partyOptions.map((n) => (
                  <PartyButton key={n} n={n} selected={partySize === n && !customParty} onClick={() => { setPartySize(n); setCustomParty(""); }} />
                ))}
                <PartyButton n={6} label="6+" selected={!!customParty || partySize >= 6} onClick={() => { setCustomParty(String(Math.max(6, partySize))); setPartySize(Math.max(6, partySize)); }} />
              </div>
              {customParty !== "" && (
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="customN">Exact aantal</Label>
                  <Input id="customN" type="number" min={6} max={50} value={customParty} className="h-12"
                    onChange={(e) => {
                      const v = e.target.value;
                      setCustomParty(v);
                      const n = parseInt(v || "0", 10);
                      if (!Number.isNaN(n) && n > 0) setPartySize(n);
                    }} />
                  {restaurant && partySize >= restaurant.large_group_threshold && (
                    <p className="text-xs text-muted-foreground">
                      Vanaf {restaurant.large_group_threshold} personen wordt dit mogelijk een aanvraag.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button className="w-full h-14 text-base" onClick={() => setStep("date")} disabled={partySize < 1}>
              Verder <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP: date */}
        {step === "date" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <button onClick={() => setStep("party")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Wijzig aantal
            </button>
            <div>
              <h2 className="font-display text-2xl mb-1">Wanneer wil je komen?</h2>
              <p className="text-sm text-muted-foreground">{partySize} {partySize === 1 ? "gast" : "gasten"}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Vandaag", offset: 0 },
                { label: "Morgen", offset: 1 },
                { label: "Overmorgen", offset: 2 },
              ].map((q) => {
                const d = new Date(); d.setDate(d.getDate() + q.offset); d.setHours(0, 0, 0, 0);
                const sel = date && format(date, "yyyy-MM-dd") === format(d, "yyyy-MM-dd");
                return (
                  <button key={q.label} type="button" onClick={() => setDate(d)}
                    className={cn(
                      "h-14 rounded-lg border-2 font-medium text-sm transition-all active:scale-95",
                      sel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40",
                    )}>
                    {q.label}
                  </button>
                );
              })}
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-14 justify-start text-base font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "EEEE d MMMM yyyy", { locale: nl }) : "Kies een datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={nl}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || d > new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)}
                  className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            <p className="text-xs text-muted-foreground">
              Dagen waarop het restaurant gesloten is, zie je verderop als geen tijden beschikbaar.
            </p>

            <Button className="w-full h-14 text-base" onClick={goToTimeFromDate} disabled={!date}>
              Bekijk tijden <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP: time */}
        {step === "time" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <button onClick={() => setStep("date")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Wijzig datum
            </button>
            <div>
              <h2 className="font-display text-2xl mb-1">Welke tijd past het beste?</h2>
              <p className="text-sm text-muted-foreground">
                {date && format(date, "EEEE d MMMM", { locale: nl })} · {partySize} {partySize === 1 ? "gast" : "gasten"}
              </p>
            </div>

            {loadingSlots ? (
              <>
                <div className="text-sm text-muted-foreground">Beschikbaarheid controleren…</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              </>
            ) : closedReason ? (
              <Card>
                <CardContent className="py-10 text-center space-y-4">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">{closedReason}</p>
                  <Button variant="outline" onClick={() => setStep("date")}>Andere datum kiezen</Button>
                </CardContent>
              </Card>
            ) : slots.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center space-y-4">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Er zijn op deze dag helaas geen tijden beschikbaar.</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => setStep("date")}>Andere datum</Button>
                    <Button onClick={() => setStep("waitlist")}>Op de wachtlijst</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.start_iso}
                      disabled={!s.available}
                      onClick={() => { setSelectedSlot(s); setStep("preferences"); }}
                      className={cn(
                        "h-12 rounded-lg border-2 font-medium text-sm transition-all touch-manipulation",
                        s.available
                          ? "border-border bg-card hover:border-primary hover:bg-primary/5 active:scale-95"
                          : "border-border/40 bg-muted text-muted-foreground/50 cursor-not-allowed",
                        s.available && s.peak_warning && "ring-1 ring-warning/40",
                      )}
                      title={!s.available ? "Vol" : s.peak_warning ? "Beperkt beschikbaar" : "Beschikbaar"}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
                {slots.every((s) => !s.available) && (
                  <PublicBookingNotice variant="warning" title="Geen plek meer op deze dag">
                    <div className="space-y-3">
                      <p>Wil je op de wachtlijst voor dit tijdstip? Dan nemen we contact op als er iets vrijkomt.</p>
                      <Button size="sm" onClick={() => setStep("waitlist")}>Op de wachtlijst</Button>
                    </div>
                  </PublicBookingNotice>
                )}
              </>
            )}
          </div>
        )}

        {/* STEP: preferences */}
        {step === "preferences" && selectedSlot && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <button onClick={() => setStep("time")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Wijzig tijd
            </button>

            <div>
              <h2 className="font-display text-2xl mb-1">Heb je voorkeuren?</h2>
              <p className="text-sm text-muted-foreground">Optioneel — alles helpt het restaurant.</p>
            </div>

            {restaurant.allow_zone_preference && (
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Waar zit je het liefst?</Label>
                <div className="flex flex-wrap gap-2">
                  {ZONES.map((z) => (
                    <Chip key={z.id} active={zone === z.id} onClick={() => setZone(z.id)}>{z.label}</Chip>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2"><Heart className="h-4 w-4" /> Speciale gelegenheid?</Label>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((o) => (
                  <Chip key={o.id} active={occasion === o.id} onClick={() => setOccasion(o.id)}>{o.label}</Chip>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="all">Allergieën of dieetwensen</Label>
              <Input id="all" value={allergies} onChange={(e) => setAllergies(e.target.value)} className="h-12"
                placeholder="Bijv. notenallergie, vegetarisch" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rq">Andere wensen of opmerkingen</Label>
              <Textarea id="rq" value={requests} onChange={(e) => setRequests(e.target.value)} rows={3}
                placeholder="Bijv. liefst tafel bij raam" />
            </div>

            <Button className="w-full h-14 text-base"
              onClick={() => setStep(restaurant.preorders_enabled ? "extras" : "guest")}>
              Verder <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP: extras */}
        {step === "extras" && selectedSlot && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <button onClick={() => setStep("preferences")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Wijzig wensen
            </button>
            <div>
              <h2 className="font-display text-2xl mb-1 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Iets klaarzetten?
              </h2>
              <p className="text-sm text-muted-foreground">Optioneel — sla deze stap gerust over.</p>
            </div>
            <PreOrderSelectionStep
              restaurantId={restaurant.id}
              allowFreeText={restaurant.preorders_allow_free_text}
              selected={preOrders}
              onChange={setPreOrders}
            />
            <Button className="w-full h-14 text-base" onClick={() => setStep("guest")}>
              Verder <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP: guest */}
        {step === "guest" && selectedSlot && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <button onClick={() => setStep(restaurant.preorders_enabled ? "extras" : "preferences")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Terug
            </button>
            <div>
              <h2 className="font-display text-2xl mb-1">Jouw gegevens</h2>
              <p className="text-sm text-muted-foreground">Zo kunnen we je bereiken over je reservering.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fn">Voornaam *</Label>
                  <Input id="fn" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-12" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ln">Achternaam</Label>
                  <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-12" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ph">Telefoon *</Label>
                <Input id="ph" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12" placeholder="06 12345678" />
                <p className="text-xs text-muted-foreground">
                  We gebruiken je nummer om je reservering te bevestigen of te bereiken als er iets verandert.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em">E-mail</Label>
                <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
              </div>

              <label className="flex items-start gap-3 cursor-pointer pt-2">
                <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(!!v)} className="mt-1" />
                <span className="text-sm text-muted-foreground">
                  Ik wil updates of acties van {restaurant.name} ontvangen.
                </span>
              </label>

              <p className="text-xs text-muted-foreground">
                Je gegevens worden gebruikt om deze reservering te verwerken en contact met je op te nemen.
              </p>
            </div>

            <Button className="w-full h-14 text-base" onClick={() => setStep("review")}>
              Naar overzicht <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP: review */}
        {step === "review" && selectedSlot && date && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <button onClick={() => setStep("guest")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Wijzig gegevens
            </button>
            <div>
              <h2 className="font-display text-2xl mb-1">Controleer je reservering</h2>
              <p className="text-sm text-muted-foreground">Klopt alles? Dan bevestigen we je reservering.</p>
            </div>

            <Card>
              <CardContent className="py-5 space-y-3 text-sm">
                <Row label="Restaurant" value={restaurant.name} />
                <Row label="Datum" value={format(date, "EEEE d MMMM yyyy", { locale: nl })} />
                <Row label="Tijd" value={selectedSlot.time} />
                <Row label="Aantal gasten" value={String(partySize)} />
                {zone !== "no_pref" && <Row label="Voorkeur" value={ZONES.find((z) => z.id === zone)?.label ?? ""} />}
                {occasion && <Row label="Gelegenheid" value={OCCASIONS.find((o) => o.id === occasion)?.label ?? ""} />}
                {allergies && <Row label="Allergieën" value={allergies} />}
                {requests && <Row label="Wensen" value={requests} />}
                {preOrders.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <div className="text-muted-foreground mb-1 flex items-center gap-1">
                      <ListPlus className="h-3.5 w-3.5" /> Vooraf klaarzetten
                    </div>
                    <ul className="space-y-1">
                      {preOrders.map((p, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{p.quantity}× {p.item_name}{p.note ? ` — ${p.note}` : ""}</span>
                          {p.unit_price_cents > 0 && (
                            <span className="text-muted-foreground">€ {((p.unit_price_cents * p.quantity) / 100).toFixed(2)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="pt-2 border-t border-border space-y-1">
                  <Row label="Naam" value={`${firstName} ${lastName}`.trim()} />
                  <Row label="Telefoon" value={phone} />
                  {email && <Row label="E-mail" value={email} />}
                </div>
              </CardContent>
            </Card>

            {bookingError && (
              <PublicBookingNotice variant="error" title="Er ging iets mis">{bookingError}</PublicBookingNotice>
            )}

            <PublicBookingNotice>
              Na bevestiging wordt je reservering opgeslagen. Berichten via e-mail of WhatsApp volgen later
              zodra het restaurant zijn communicatie heeft gekoppeld.
            </PublicBookingNotice>

            <Button className="w-full h-14 text-base" onClick={handleBook} disabled={submitting}>
              {submitting ? "Beschikbaarheid controleren…" : "Reservering bevestigen"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Door te bevestigen ga je akkoord met de annuleringsvoorwaarden van het restaurant.
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
                {confirmation.status === "pending" ? "Aanvraag ontvangen" : "Je reservering is ontvangen"}
              </h1>
              <p className="text-muted-foreground">
                {confirmation.status === "pending"
                  ? `${restaurant.name} controleert je reservering en bevestigt persoonlijk.`
                  : `Je reservering bij ${restaurant.name} staat in de agenda.`}
              </p>
            </div>
            <Card className="text-left">
              <CardContent className="py-5 space-y-3">
                <Row label="Datum & tijd" value={format(new Date(confirmation.start), "EEE d MMM · HH:mm", { locale: nl })} />
                <Row label="Aantal gasten" value={String(partySize)} />
                <Row label="Bevestigingscode" value={confirmation.code} mono />
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
              Je ontvangt later een bevestiging via je voorkeurskanaal zodra het restaurant zijn communicatie heeft gekoppeld.
            </p>
            <Button variant="outline" onClick={reset}>Nieuwe reservering</Button>
          </div>
        )}

        {/* SUB-FLOW: large group */}
        {step === "large_group" && (
          <LargeGroupForm
            restaurant={restaurant}
            initialPartySize={Math.max(restaurant.large_group_threshold, partySize)}
            initialDate={date}
            sourceChannel={sourceInfo.source_channel}
            onBack={() => setStep("party")}
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
            onBack={() => setStep("time")}
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
    if (!name.trim() || !emailV.trim() || !partySize) return toast.error("Vul de verplichte velden in");
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
        <h1 className="font-display text-3xl">Je groepsaanvraag is ontvangen</h1>
        <p className="text-muted-foreground">
          Voor deze groepsgrootte controleert {restaurant.name} de beschikbaarheid persoonlijk.
        </p>
        <Button variant="outline" onClick={onBack}>Terug</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 animate-in fade-in duration-300">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Terug
      </button>
      <div>
        <h1 className="font-display text-3xl mb-2">Groepsaanvraag</h1>
        <p className="text-muted-foreground">
          Gezellig, jullie komen met een grotere groep. Voor groepen vanaf {restaurant.large_group_threshold} personen plannen we persoonlijk in.
        </p>
      </div>

      <PublicBookingNotice>
        Voor grotere groepen kan het restaurant later om een reserveringsgarantie vragen.
      </PublicBookingNotice>

      <div className="space-y-1.5">
        <Label>Aantal personen *</Label>
        <Input type="number" min={restaurant.large_group_threshold} max={200} required
          value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className="h-12" />
      </div>
      <div className="space-y-1.5">
        <Label>Naam *</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>E-mail *</Label>
          <Input type="email" required value={emailV} onChange={(e) => setEmailV(e.target.value)} className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label>Telefoon</Label>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Voorkeursdatum</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-12 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "d MMM yyyy", { locale: nl }) : "—"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} locale={nl}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                className={cn("p-3 pointer-events-auto")} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label>Voorkeurstijd</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-12" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Gelegenheid</Label>
        <Input value={occasion} onChange={(e) => setOccasion(e.target.value)} className="h-12"
          placeholder="Verjaardag, zakelijk diner, bruiloft…" />
      </div>
      <div className="space-y-1.5">
        <Label>Bericht</Label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
          placeholder="Wensen, dieetinformatie, drankarrangement…" />
      </div>

      <Button type="submit" className="w-full h-14 text-base" disabled={submitting}>
        {submitting ? "Versturen…" : "Aanvraag versturen"}
      </Button>
    </form>
  );
};

export default ReserveWidget;
