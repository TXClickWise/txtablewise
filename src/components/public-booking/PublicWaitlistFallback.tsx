// Waitlist fallback form for the public widget.
// Used when no slot is available on the requested day. Reuses the same
// guest fields the user already started with.
import { useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Clock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { submitWaitlist, SourceChannel } from "@/services/publicBooking";
import { PublicBookingNotice } from "./PublicBookingNotice";

export const PublicWaitlistFallback = ({
  restaurantId,
  restaurantName,
  date,
  partySize,
  initialFirstName = "",
  initialLastName = "",
  initialEmail = "",
  initialPhone = "",
  sourceChannel,
  onBack,
}: {
  restaurantId: string;
  restaurantName: string;
  date: Date;
  partySize: number;
  initialFirstName?: string;
  initialLastName?: string;
  initialEmail?: string;
  initialPhone?: string;
  sourceChannel: SourceChannel;
  onBack: () => void;
}) => {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [from, setFrom] = useState("18:00");
  const [to, setTo] = useState("21:00");
  const [notes, setNotes] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return toast.error("Voornaam is verplicht");
    if (!phone.trim() && !email.trim()) return toast.error("Vul telefoon of e-mail in zodat we contact kunnen opnemen");
    if (from >= to) return toast.error("Eindtijd moet na begintijd liggen");

    setSubmitting(true);
    const res = await submitWaitlist({
      restaurant_id: restaurantId,
      first_name: firstName.trim(),
      last_name: lastName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      party_size: partySize,
      desired_date: format(date, "yyyy-MM-dd"),
      desired_time_from: from,
      desired_time_to: to,
      notes: notes.trim() || undefined,
      marketing_consent: marketing,
      source_channel: sourceChannel,
    });
    setSubmitting(false);
    if (!res.ok) return toast.error(res.error || "Kon je niet op de wachtlijst zetten");
    setDone(true);
  };

  if (done) {
    return (
      <div className="space-y-6 text-center py-8 animate-in fade-in duration-300">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-3xl mb-2">Je staat op de wachtlijst</h1>
          <p className="text-muted-foreground">
            Komt er iets vrij op {format(date, "EEEE d MMMM", { locale: nl })}? Dan kan {restaurantName} contact met je opnemen.
          </p>
        </div>
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
        <h1 className="font-display text-3xl mb-2">Op de wachtlijst</h1>
        <p className="text-muted-foreground">
          Vol op {format(date, "EEEE d MMMM", { locale: nl })}? Laat je gegevens achter — als er iets vrijkomt nemen we contact op.
        </p>
      </div>

      <Card className="bg-secondary/30 border-border/60">
        <CardContent className="py-4 flex items-center gap-3 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          <span>{partySize} {partySize === 1 ? "gast" : "gasten"} · {format(date, "EEE d MMM", { locale: nl })}</span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="wfn">Voornaam *</Label>
          <Input id="wfn" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wln">Achternaam</Label>
          <Input id="wln" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-12" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wph">Telefoon</Label>
        <Input id="wph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12" placeholder="06 12345678" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wem">E-mail</Label>
        <Input id="wem" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Vanaf</Label>
          <Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label>Tot</Label>
          <Input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="h-12" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Opmerking</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="Bijv. liefst tussen 19:00 en 20:00, of: kan ook morgen" />
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(!!v)} className="mt-1" />
        <span className="text-sm text-muted-foreground">
          Ik wil ook updates of acties van {restaurantName} ontvangen.
        </span>
      </label>

      <PublicBookingNotice variant="info">
        We versturen nu nog geen automatische berichten — het restaurant neemt zelf contact op zodra er iets vrijkomt.
      </PublicBookingNotice>

      <Button type="submit" className="w-full h-14 text-base" disabled={submitting}>
        {submitting ? "Versturen…" : "Zet mij op de wachtlijst"}
      </Button>
    </form>
  );
};
