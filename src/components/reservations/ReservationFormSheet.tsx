// ReservationFormSheet — operator flow to create a reservation.
// Uses the public availability edge function to preview a slot and book_reservation
// with channel='manager' so it bypasses the online lead-time / pacing limits.
import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Search, CalendarPlus } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Slot = { time: string; available: boolean; available_table_count: number; peak_warning?: boolean };
type Preview = {
  loading: boolean;
  slots?: Slot[];
  closed?: boolean;
  message?: string;
  error?: string;
} | null;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function ReservationFormSheet({ open, onOpenChange }: Props) {
  const { current } = useRestaurant();
  const qc = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("19:00");
  const [partySize, setPartySize] = useState(2);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [occasion, setOccasion] = useState("");
  const [preview, setPreview] = useState<Preview>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pull large-group thresholds so the operator sees a heads-up while booking.
  const { data: lgConfig } = useQuery({
    queryKey: ["lg-config-form", current?.restaurant_id],
    enabled: !!current?.restaurant_id,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants")
        .select("large_group_threshold, large_group_manual_approval_from, large_group_extra_minutes, large_group_deposit_recommended_from")
        .eq("id", current!.restaurant_id).maybeSingle();
      return data;
    },
  });
  const isLargeGroup = !!lgConfig && partySize >= (lgConfig.large_group_threshold ?? 8);
  const needsApproval = !!lgConfig && partySize >= (lgConfig.large_group_manual_approval_from ?? 10);
  const recommendDeposit = !!lgConfig && partySize >= (lgConfig.large_group_deposit_recommended_from ?? 8);

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    setNotes(""); setOccasion(""); setPreview(null);
  };

  const checkAvailability = async () => {
    if (!current) return;
    setPreview({ loading: true });
    const { data, error } = await supabase.functions.invoke("availability", {
      body: { restaurant_id: current.restaurant_id, date, party_size: partySize },
    });
    if (error) {
      setPreview({ loading: false, error: "De beschikbaarheid kon niet worden gecontroleerd." });
      return;
    }
    if (data?.closed) {
      setPreview({ loading: false, closed: true, message: data.message });
      return;
    }
    setPreview({ loading: false, slots: (data?.slots ?? []) as Slot[] });
  };

  const submit = async () => {
    if (!current) return;
    if (!firstName.trim()) return toast.error("Naam is verplicht.");
    if (!email.trim()) return toast.error("E-mail is verplicht voor reservering.");
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("book_reservation", {
      body: {
        restaurant_id: current.restaurant_id,
        date, time, party_size: partySize,
        guest: {
          first_name: firstName.trim(),
          last_name: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim(),
          language: "nl",
        },
        special_requests: notes || undefined,
        occasion: occasion || undefined,
        channel: "manager",
      },
    });
    setSubmitting(false);
    const fnErr = (data as { error?: string }) || {};
    if (error || fnErr.error) {
      return toast.error(fnErr.error || "De reservering is niet opgeslagen. Probeer het opnieuw.");
    }
    toast.success("Reservering aangemaakt.");
    qc.invalidateQueries();
    reset();
    onOpenChange(false);
  };

  // Suggest alternative times when chosen time isn't available
  const chosenSlot = preview?.slots?.find((s) => s.time === time);
  const alternatives = preview?.slots
    ?.filter((s) => s.available && s.time !== time)
    .slice(0, 6) ?? [];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" /> Nieuwe reservering
          </SheetTitle>
          <SheetDescription>
            Wijzigingen in datum, tijd, aantal personen of tafel controleren we opnieuw op beschikbaarheid.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Datum</Label>
              <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPreview(null); }} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Tijd</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Aantal personen</Label>
              <Input
                type="number" min={1} max={50}
                value={partySize}
                onChange={(e) => { setPartySize(Number(e.target.value) || 1); setPreview(null); }}
                className="h-11"
              />
            </div>
          </div>

          {isLargeGroup && (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm space-y-1">
              <div className="font-medium text-warning">Grote groep ({partySize} personen)</div>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                <li>Verblijfsduur is automatisch +{lgConfig?.large_group_extra_minutes ?? 30} minuten.</li>
                {needsApproval && <li>Wordt aangemaakt als <strong>in afwachting</strong> — beoordeel daarna in 'Grote groepen'.</li>}
                {recommendDeposit && <li>Aanbetaling aanbevolen voor deze groepsgrootte (manueel afspreken).</li>}
              </ul>
            </div>
          )}

          <Button variant="outline" className="w-full h-11 gap-2" onClick={checkAvailability} disabled={preview?.loading}>
            {preview?.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Beschikbaarheid controleren
          </Button>

          {preview?.error && (
            <div className="text-sm text-destructive">{preview.error}</div>
          )}
          {preview?.closed && (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              {preview.message ?? "Gesloten op deze dag."}
            </div>
          )}
          {preview?.slots && (
            <div className="space-y-2">
              {chosenSlot?.available ? (
                <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                  {time} is beschikbaar. {chosenSlot.peak_warning && "Let op: het wordt op dit moment druk."}
                </div>
              ) : (
                <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
                  <div className="font-medium text-warning">{time} is niet beschikbaar.</div>
                  {alternatives.length > 0 && (
                    <>
                      <div className="text-xs text-muted-foreground mt-1 mb-2">Wel beschikbaar:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {alternatives.map((s) => (
                          <button
                            key={s.time}
                            type="button"
                            onClick={() => setTime(s.time)}
                            className={cn(
                              "px-2 py-1 rounded border text-xs transition-colors",
                              "border-border hover:border-primary hover:bg-primary/5",
                              s.peak_warning && "border-warning/40",
                            )}
                          >
                            {s.time}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Voornaam *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Achternaam</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefoon</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Speciale gelegenheid</Label>
              <Input value={occasion} onChange={(e) => setOccasion(e.target.value)} className="h-11" placeholder="Verjaardag, jubileum…" />
            </div>
            <div className="space-y-1.5">
              <Label>Notitie</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergie, voorkeur tafel…" />
            </div>
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Bezig…" : "Reservering maken"}
          </Button>
        </SheetFooter>
        <p className="text-xs text-muted-foreground mt-2">
          De bevestiging kan later automatisch via ClickWise worden verstuurd.
        </p>
      </SheetContent>
    </Sheet>
  );
}
