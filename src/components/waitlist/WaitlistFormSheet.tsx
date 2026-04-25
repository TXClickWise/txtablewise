import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { createWaitlistEntry, updateWaitlistEntry, type WaitlistEntry } from "@/services/waitlist";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  /** When provided, edit instead of create. */
  entry?: WaitlistEntry | null;
  /** Pre-fill values when starting from a fallback (e.g. full slot). */
  prefill?: {
    desiredDate?: string;
    desiredTimeFrom?: string;
    partySize?: number;
    zonePreference?: string | null;
    channel?: string;
  };
  onSaved?: (entry: WaitlistEntry) => void;
};

export function WaitlistFormSheet({ open, onOpenChange, restaurantId, entry, prefill, onSaved }: Props) {
  const isEdit = !!entry;
  const [busy, setBusy] = useState(false);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    desiredDate: format(new Date(), "yyyy-MM-dd"),
    desiredTimeFrom: "",
    desiredTimeTo: "",
    partySize: 2,
    zonePreference: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    supabase
      .from("zones")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setZones(data || []));
  }, [open, restaurantId]);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({
        firstName: entry.first_name,
        lastName: entry.last_name || "",
        phone: entry.phone || "",
        email: entry.email || "",
        desiredDate: entry.desired_date,
        desiredTimeFrom: entry.desired_time_from?.slice(0, 5) || "",
        desiredTimeTo: entry.desired_time_to?.slice(0, 5) || "",
        partySize: entry.party_size,
        zonePreference: entry.zone_preference || "",
        notes: entry.notes || "",
      });
    } else {
      setForm({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        desiredDate: prefill?.desiredDate || format(new Date(), "yyyy-MM-dd"),
        desiredTimeFrom: prefill?.desiredTimeFrom?.slice(0, 5) || "",
        desiredTimeTo: "",
        partySize: prefill?.partySize ?? 2,
        zonePreference: prefill?.zonePreference || "",
        notes: "",
      });
    }
  }, [open, entry, prefill]);

  const submit = async () => {
    setBusy(true);
    const payload = {
      restaurantId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      desiredDate: form.desiredDate,
      desiredTimeFrom: form.desiredTimeFrom || undefined,
      desiredTimeTo: form.desiredTimeTo || undefined,
      partySize: Number(form.partySize),
      zonePreference: form.zonePreference || undefined,
      notes: form.notes.trim() || undefined,
      channel: prefill?.channel || "phone",
    };
    const result = isEdit && entry
      ? await updateWaitlistEntry(entry.id, {
          firstName: payload.firstName,
          lastName: payload.lastName ?? null,
          phone: payload.phone ?? null,
          email: payload.email ?? null,
          desiredDate: payload.desiredDate,
          desiredTimeFrom: payload.desiredTimeFrom,
          desiredTimeTo: payload.desiredTimeTo,
          partySize: payload.partySize,
          zonePreference: payload.zonePreference ?? null,
          notes: payload.notes ?? null,
        })
      : await createWaitlistEntry(payload);
    setBusy(false);
    if (!result.ok) return toast.error(result.error || "Opslaan mislukt.");
    toast.success(isEdit ? "Wachtlijstitem bijgewerkt." : "Gast op wachtlijst gezet.");
    if (result.entry) onSaved?.(result.entry);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">
            {isEdit ? "Wachtlijstitem bewerken" : "Wachtlijstitem toevoegen"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Zet een gast op de wachtlijst en vul vrijgekomen tafels sneller op.
          </p>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="wl-first">Voornaam *</Label>
              <Input id="wl-first" value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wl-last">Achternaam</Label>
              <Input id="wl-last" value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="wl-phone">Telefoon</Label>
              <Input id="wl-phone" type="tel" value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wl-email">E-mail</Label>
              <Input id="wl-email" type="email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          {!form.phone && !form.email && (
            <p className="text-xs text-muted-foreground">
              Voeg een telefoonnummer of e-mailadres toe om de gast later te kunnen bereiken.
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="wl-date">Datum *</Label>
              <Input id="wl-date" type="date" value={form.desiredDate}
                onChange={(e) => setForm((f) => ({ ...f, desiredDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wl-from">Vanaf</Label>
              <Input id="wl-from" type="time" value={form.desiredTimeFrom}
                onChange={(e) => setForm((f) => ({ ...f, desiredTimeFrom: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wl-to">Tot</Label>
              <Input id="wl-to" type="time" value={form.desiredTimeTo}
                onChange={(e) => setForm((f) => ({ ...f, desiredTimeTo: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="wl-party">Aantal personen *</Label>
              <Input id="wl-party" type="number" min={1} max={50} value={form.partySize}
                onChange={(e) => setForm((f) => ({ ...f, partySize: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>Zonevoorkeur</Label>
              <Select value={form.zonePreference || "any"}
                onValueChange={(v) => setForm((f) => ({ ...f, zonePreference: v === "any" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Geen voorkeur</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="wl-notes">Notitie</Label>
            <Textarea id="wl-notes" rows={3} value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Bv. wil graag bij het raam, jarig, kinderstoel nodig..." />
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1 h-11" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button className="flex-1 h-11" disabled={busy} onClick={submit}>
            {busy ? "Opslaan…" : isEdit ? "Opslaan" : "Op wachtlijst zetten"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
