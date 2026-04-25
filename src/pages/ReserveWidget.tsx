import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarIcon, Users, Clock, ChevronRight, Check, ArrowLeft } from "lucide-react";
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

type Slot = {
  time: string;
  start_iso: string;
  end_iso: string;
  available: boolean;
  available_table_count: number;
};

type RestaurantInfo = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  max_party_size_online: number;
  large_group_threshold: number;
};

type Step = "intro" | "slot" | "details" | "confirmed" | "large_group";

const guestSchema = z.object({
  first_name: z.string().trim().min(1, "Voornaam is verplicht").max(80),
  last_name: z.string().trim().max(80).optional(),
  email: z.string().trim().email("Geldig e-mailadres vereist").max(255),
  phone: z.string().trim().max(40).optional(),
});

const PartyButton = ({ n, selected, onClick }: { n: number; selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "h-14 rounded-lg border-2 font-medium text-base transition-all",
      "active:scale-95 touch-manipulation",
      selected
        ? "border-primary bg-primary text-primary-foreground shadow-md"
        : "border-border bg-card hover:border-primary/40"
    )}
  >
    {n}
  </button>
);

const ReserveWidget = () => {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [step, setStep] = useState<Step>("intro");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [partySize, setPartySize] = useState<number>(2);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ code: string; start: string } | null>(null);

  // Guest fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");
  const [marketing, setMarketing] = useState(false);

  // Load restaurant on mount
  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, slug, timezone, max_party_size_online, large_group_threshold")
        .eq("slug", slug).maybeSingle();
      if (error || !data) {
        toast.error("Restaurant niet gevonden");
        return;
      }
      setRestaurant(data as RestaurantInfo);
    })();
  }, [slug]);

  const fetchSlots = async () => {
    if (!restaurant || !date) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);
    const dateStr = format(date, "yyyy-MM-dd");
    const { data, error } = await supabase.functions.invoke("availability", {
      body: { restaurant_id: restaurant.id, date: dateStr, party_size: partySize },
    });
    setLoadingSlots(false);
    if (error) {
      toast.error("Kon geen tijden ophalen");
      return;
    }
    if (data?.large_group) {
      setStep("large_group");
      return;
    }
    setSlots(data?.slots ?? []);
  };

  const handleContinue = async () => {
    if (!date) {
      toast.error("Kies een datum");
      return;
    }
    if (partySize > (restaurant?.max_party_size_online ?? 8)) {
      setStep("large_group");
      return;
    }
    setStep("slot");
    await fetchSlots();
  };

  // Refetch when party/date changes on slot step
  useEffect(() => {
    if (step === "slot") fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partySize, date]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant || !selectedSlot || !date) return;
    const parsed = guestSchema.safeParse({ first_name: firstName, last_name: lastName, email, phone });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("book_reservation", {
      body: {
        restaurant_id: restaurant.id,
        date: format(date, "yyyy-MM-dd"),
        time: selectedSlot.time,
        party_size: partySize,
        guest: {
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          language: "nl",
        },
        special_requests: requests || undefined,
        marketing_consent: marketing,
        channel: "online",
      },
    });
    setSubmitting(false);
    if (error || data?.error) {
      const msg = (data?.error as string) || "Reservering mislukt";
      toast.error(msg);
      if (data?.retry) {
        await fetchSlots();
        setStep("slot");
      }
      return;
    }
    setConfirmation({ code: data.reservation.confirmation_code, start: data.reservation.start_time });
    setStep("confirmed");
  };

  const partyOptions = useMemo(() => {
    const max = restaurant?.max_party_size_online ?? 8;
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [restaurant]);

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Laden…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-display text-lg text-primary">TableWise</Link>
          <span className="text-sm text-muted-foreground truncate ml-3">{restaurant.name}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {step === "intro" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl mb-2">Reserveer een tafel</h1>
              <p className="text-muted-foreground">Bij {restaurant.name}. Direct bevestigd.</p>
            </div>

            {/* Party size */}
            <div className="space-y-3">
              <Label className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Aantal gasten
              </Label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {partyOptions.map((n) => (
                  <PartyButton key={n} n={n} selected={partySize === n} onClick={() => setPartySize(n)} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Vanaf {restaurant.large_group_threshold} personen graag een groepsaanvraag.
              </p>
            </div>

            {/* Date */}
            <div className="space-y-3">
              <Label className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" /> Datum
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-14 justify-start text-base font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "EEEE d MMMM yyyy", { locale: nl }) : "Kies een datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    locale={nl}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || d > new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button className="w-full h-14 text-base" onClick={handleContinue} disabled={!date}>
              Bekijk tijden <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "slot" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <button onClick={() => setStep("intro")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Wijzig datum/groep
            </button>
            <div>
              <h2 className="font-display text-2xl mb-1">Beschikbare tijden</h2>
              <p className="text-sm text-muted-foreground">
                {date && format(date, "EEEE d MMMM", { locale: nl })} · {partySize} {partySize === 1 ? "gast" : "gasten"}
              </p>
            </div>

            {loadingSlots ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Clock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">Geen tijden beschikbaar voor deze dag.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setStep("intro")}>
                    Probeer een andere datum
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((s) => (
                  <button
                    key={s.start_iso}
                    disabled={!s.available}
                    onClick={() => { setSelectedSlot(s); setStep("details"); }}
                    className={cn(
                      "h-12 rounded-lg border-2 font-medium text-sm transition-all touch-manipulation",
                      s.available
                        ? "border-border bg-card hover:border-primary hover:bg-primary/5 active:scale-95"
                        : "border-border/40 bg-muted text-muted-foreground/50 cursor-not-allowed"
                    )}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "details" && selectedSlot && (
          <form onSubmit={handleBook} className="space-y-6 animate-in fade-in duration-300">
            <button type="button" onClick={() => setStep("slot")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Wijzig tijd
            </button>

            <Card className="bg-secondary/30 border-border/60">
              <CardContent className="py-4 flex items-center gap-4">
                <div className="text-center px-3 border-r border-border">
                  <div className="text-xs text-muted-foreground uppercase">{date && format(date, "MMM", { locale: nl })}</div>
                  <div className="font-display text-2xl">{date && format(date, "d")}</div>
                </div>
                <div className="flex-1 text-sm space-y-0.5">
                  <div className="font-medium">{date && format(date, "EEEE", { locale: nl })} · {selectedSlot.time}</div>
                  <div className="text-muted-foreground">{partySize} {partySize === 1 ? "gast" : "gasten"} · {restaurant.name}</div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h2 className="font-display text-xl">Jouw gegevens</h2>
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
                <Label htmlFor="em">E-mail *</Label>
                <Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ph">Telefoon</Label>
                <Input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12" placeholder="06 12345678" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="req">Speciale wensen of allergieën</Label>
                <Textarea id="req" value={requests} onChange={(e) => setRequests(e.target.value)} rows={3}
                  placeholder="Bijv. verjaardag, allergie voor noten, voorkeur tafel bij raam…" />
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(!!v)} className="mt-1" />
                <span className="text-sm text-muted-foreground">
                  Houd me op de hoogte van events en aanbiedingen van {restaurant.name}.
                </span>
              </label>
            </div>

            <Button type="submit" className="w-full h-14 text-base" disabled={submitting}>
              {submitting ? "Bezig met reserveren…" : "Bevestig reservering"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Door te bevestigen ga je akkoord met de annuleringsvoorwaarden van het restaurant.
            </p>
          </form>
        )}

        {step === "confirmed" && confirmation && (
          <div className="space-y-6 animate-in fade-in duration-300 text-center py-8">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl mb-2">Bevestigd!</h1>
              <p className="text-muted-foreground">Je reservering bij {restaurant.name} staat in onze agenda.</p>
            </div>
            <Card className="text-left">
              <CardContent className="py-5 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Datum & tijd</span>
                  <span className="font-medium">
                    {format(new Date(confirmation.start), "EEE d MMM · HH:mm", { locale: nl })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Aantal gasten</span>
                  <span className="font-medium">{partySize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Bevestigingscode</span>
                  <span className="font-mono font-medium tracking-wider">{confirmation.code}</span>
                </div>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
              We hebben een bevestiging gestuurd naar <strong>{email}</strong>.
            </p>
            <Button variant="outline" onClick={() => {
              setStep("intro"); setConfirmation(null); setSelectedSlot(null);
              setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setRequests(""); setMarketing(false);
            }}>
              Nieuwe reservering
            </Button>
          </div>
        )}

        {step === "large_group" && (
          <LargeGroupForm restaurant={restaurant} onBack={() => setStep("intro")} />
        )}
      </main>
    </div>
  );
};

const LargeGroupForm = ({ restaurant, onBack }: { restaurant: RestaurantInfo; onBack: () => void }) => {
  const [name, setName] = useState("");
  const [emailV, setEmailV] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(restaurant.large_group_threshold);
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("");
  const [occasion, setOccasion] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !emailV.trim() || !partySize) {
      toast.error("Vul de verplichte velden in");
      return;
    }
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
      message: message || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div className="space-y-6 text-center py-8 animate-in fade-in duration-300">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-3xl">Aanvraag ontvangen</h1>
        <p className="text-muted-foreground">
          {restaurant.name} neemt zo snel mogelijk persoonlijk contact met je op om je groep in te plannen.
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
          Voor groepen vanaf {restaurant.large_group_threshold} personen plannen we persoonlijk in.
        </p>
      </div>

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
