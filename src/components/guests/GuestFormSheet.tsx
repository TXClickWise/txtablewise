// Sheet voor gast aanmaken én wijzigen.
// Toont eventueel duplicate-waarschuwing op basis van telefoon/e-mail.
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  createGuest, updateGuest, detectPossibleDuplicates, type Guest, type GuestInput,
} from "@/services/guests";
import { GuestDuplicateWarning } from "./GuestDuplicateWarning";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  guest?: Guest | null;
  onSaved?: (guest: Guest) => void;
  onUseExisting?: (guest: Guest) => void;
};

const EMPTY: GuestInput = {
  first_name: "", last_name: "", email: "", phone: "",
  language: "nl", preferred_channel: null,
  is_vip: false, marketing_consent: false,
  allergies: "", dietary_preferences: "", seating_preferences: "",
  hospitality_notes: "",
};

export function GuestFormSheet({ open, onOpenChange, restaurantId, guest, onSaved, onUseExisting }: Props) {
  const editing = !!guest;
  const [form, setForm] = useState<GuestInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [dupes, setDupes] = useState<Guest[]>([]);

  useEffect(() => {
    if (!open) return;
    setDupes([]);
    if (guest) {
      setForm({
        first_name: guest.first_name ?? "",
        last_name: guest.last_name ?? "",
        email: guest.email ?? "",
        phone: guest.phone ?? "",
        language: guest.language ?? "nl",
        preferred_channel: guest.preferred_channel,
        is_vip: guest.is_vip,
        marketing_consent: guest.marketing_consent,
        allergies: guest.allergies ?? "",
        dietary_preferences: guest.dietary_preferences ?? "",
        seating_preferences: guest.seating_preferences ?? "",
        hospitality_notes: guest.hospitality_notes ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, guest]);

  // Live duplicate detection on phone/email change (only when creating)
  useEffect(() => {
    if (editing) return;
    const phone = form.phone?.trim();
    const email = form.email?.trim();
    if (!phone && !email) { setDupes([]); return; }
    const t = setTimeout(async () => {
      try {
        const d = await detectPossibleDuplicates(restaurantId, {
          phone: phone || null, email: email || null,
        });
        setDupes(d);
      } catch { /* ignore */ }
    }, 350);
    return () => clearTimeout(t);
  }, [form.phone, form.email, restaurantId, editing]);

  const canSubmit = useMemo(() =>
    !!(form.first_name?.trim() || form.last_name?.trim() || form.phone?.trim() || form.email?.trim()),
    [form],
  );

  const submit = async () => {
    setBusy(true);
    try {
      const saved = editing
        ? await updateGuest(restaurantId, guest!.id, form)
        : await createGuest(restaurantId, form);
      toast.success(editing ? "Gast bijgewerkt." : "Gast toegevoegd.");
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deze gast kon niet worden opgeslagen. Probeer het opnieuw.");
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">
            {editing ? "Gast wijzigen" : "Nieuwe gast"}
          </SheetTitle>
          <SheetDescription>
            Voeg alleen informatie toe die helpt om de gast beter en zorgvuldiger te ontvangen.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Voornaam</Label>
              <Input value={form.first_name ?? ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Achternaam</Label>
              <Input value={form.last_name ?? ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Telefoon</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+31 6 ..." />
            </div>
          </div>

          {dupes.length > 0 && onUseExisting && (
            <GuestDuplicateWarning
              candidates={dupes}
              onUseExisting={(g) => { onUseExisting(g); onOpenChange(false); }}
              onIgnore={() => setDupes([])}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Voorkeurstaal</Label>
              <Select value={form.language ?? "nl"} onValueChange={(v) => setForm({ ...form, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nl">Nederlands</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Voorkeurkanaal</Label>
              <Select
                value={form.preferred_channel ?? "none"}
                onValueChange={(v) => setForm({ ...form, preferred_channel: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Geen voorkeur" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen voorkeur</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefoon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Allergieën</Label>
            <Input value={form.allergies ?? ""} onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              placeholder="Bv. noten, gluten" />
            <p className="text-[11px] text-muted-foreground">Alleen voor service en veiligheid gebruiken.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dieetwensen</Label>
            <Input value={form.dietary_preferences ?? ""} onChange={(e) => setForm({ ...form, dietary_preferences: e.target.value })}
              placeholder="Bv. vegetarisch, halal" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Zitvoorkeur</Label>
            <Input value={form.seating_preferences ?? ""} onChange={(e) => setForm({ ...form, seating_preferences: e.target.value })}
              placeholder="Bv. rustige tafel, terras" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hospitality-notitie</Label>
            <Textarea rows={3} value={form.hospitality_notes ?? ""}
              onChange={(e) => setForm({ ...form, hospitality_notes: e.target.value })}
              placeholder="Bv. komt vaak op vrijdagavond, vierde verjaardag in 2024" />
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">VIP / vaste gast</Label>
                <p className="text-xs text-muted-foreground">Subtiel zichtbaar voor extra aandacht.</p>
              </div>
              <Switch checked={!!form.is_vip} onCheckedChange={(v) => setForm({ ...form, is_vip: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Gast geeft toestemming voor marketing/opvolging</Label>
                <p className="text-xs text-muted-foreground">Standaard uit. Alleen aanzetten bij expliciete toestemming.</p>
              </div>
              <Switch checked={!!form.marketing_consent}
                onCheckedChange={(v) => setForm({ ...form, marketing_consent: v })} />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 px-6 py-3 border-t bg-background flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={submit} disabled={!canSubmit || busy}>
            {busy ? "Opslaan…" : (editing ? "Opslaan" : "Toevoegen")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
