// LargeGroupSettings — operator-facing tab to tune large-group behaviour.
// All fields map directly to columns on `restaurants`. No payment provider yet —
// the deposit-related field is purely advisory (recommendation threshold).

import { useEffect, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Users, Info } from "lucide-react";

type Form = {
  large_group_threshold: number;
  large_group_minutes: number;
  large_group_extra_minutes: number;
  extra_large_group_threshold: number | "";
  large_group_manual_approval_from: number;
  large_group_deposit_recommended_from: number;
  large_group_extra_info_from: number | "";
  large_group_max_online_request: number | "";
  large_group_default_status: string;
  large_group_confirmation_text: string;
  large_group_cancellation_terms: string;
  large_group_response_sla_label: string;
  large_group_response_channel_label: string;
  noshow_deposit_rules_prepared: boolean;
  transfer_phone: string;
  transfer_hours_start: string;
  transfer_hours_end: string;
  default_reservation_minutes: number;
};

const defaults: Form = {
  large_group_threshold: 8,
  large_group_minutes: 150,
  large_group_extra_minutes: 30,
  extra_large_group_threshold: "",
  large_group_manual_approval_from: 11,
  large_group_deposit_recommended_from: 8,
  large_group_extra_info_from: "",
  large_group_max_online_request: "",
  large_group_default_status: "pending",
  large_group_confirmation_text: "",
  large_group_cancellation_terms: "",
  noshow_deposit_rules_prepared: false,
  transfer_phone: "",
  transfer_hours_start: "",
  transfer_hours_end: "",
  default_reservation_minutes: 105,
};

const LargeGroupSettings = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const [form, setForm] = useState<Form>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("restaurants")
        .select(`
          large_group_threshold, large_group_minutes, large_group_extra_minutes, large_group_manual_approval_from,
          large_group_deposit_recommended_from, large_group_default_status,
          large_group_confirmation_text, large_group_cancellation_terms, noshow_deposit_rules_prepared,
          large_group_extra_info_from, large_group_max_online_request, extra_large_group_threshold,
          transfer_phone, transfer_hours_start, transfer_hours_end, default_reservation_minutes
        `)
        .eq("id", restaurantId).maybeSingle();
      if (data) {
        setForm({
          large_group_threshold: data.large_group_threshold ?? defaults.large_group_threshold,
          large_group_minutes: (data as any).large_group_minutes ?? defaults.large_group_minutes,
          large_group_extra_minutes: data.large_group_extra_minutes ?? defaults.large_group_extra_minutes,
          extra_large_group_threshold: (data as any).extra_large_group_threshold ?? "",
          large_group_manual_approval_from: data.large_group_manual_approval_from ?? defaults.large_group_manual_approval_from,
          large_group_deposit_recommended_from: data.large_group_deposit_recommended_from ?? defaults.large_group_deposit_recommended_from,
          large_group_extra_info_from: (data as any).large_group_extra_info_from ?? "",
          large_group_max_online_request: (data as any).large_group_max_online_request ?? "",
          large_group_default_status: data.large_group_default_status ?? defaults.large_group_default_status,
          large_group_confirmation_text: data.large_group_confirmation_text ?? "",
          large_group_cancellation_terms: data.large_group_cancellation_terms ?? "",
          noshow_deposit_rules_prepared: data.noshow_deposit_rules_prepared ?? false,
          transfer_phone: (data as any).transfer_phone ?? "",
          transfer_hours_start: ((data as any).transfer_hours_start ?? "").slice(0, 5),
          transfer_hours_end: ((data as any).transfer_hours_end ?? "").slice(0, 5),
          default_reservation_minutes: (data as any).default_reservation_minutes ?? 105,
        });
      }
      setLoading(false);
    })();
  }, [restaurantId]);

  const save = async () => {
    if (!restaurantId) return;
    const xl = form.extra_large_group_threshold === "" ? null : Number(form.extra_large_group_threshold);
    const maxOnline = form.large_group_max_online_request === "" ? null : Number(form.large_group_max_online_request);

    if (xl !== null && xl <= form.large_group_threshold) {
      toast.error('"Extra-grote groep vanaf" moet groter zijn dan "Grote groep vanaf".');
      return;
    }
    if (form.large_group_manual_approval_from < form.large_group_threshold) {
      toast.error('"Handmatige goedkeuring vanaf" mag niet kleiner zijn dan "Grote groep vanaf".');
      return;
    }
    if (maxOnline !== null && maxOnline < form.large_group_threshold) {
      toast.error('"Maximale online groepsaanvraag" mag niet kleiner zijn dan "Grote groep vanaf".');
      return;
    }

    setSaving(true);
    const payload = {
      large_group_threshold: form.large_group_threshold,
      large_group_minutes: Number(form.large_group_minutes) || 150,
      large_group_extra_minutes: Number(form.large_group_extra_minutes) || 0,
      extra_large_group_threshold: xl,
      large_group_manual_approval_from: form.large_group_manual_approval_from,
      large_group_deposit_recommended_from: form.large_group_deposit_recommended_from,
      large_group_extra_info_from: form.large_group_extra_info_from === "" ? null : Number(form.large_group_extra_info_from),
      large_group_max_online_request: maxOnline,
      large_group_default_status: form.large_group_default_status,
      large_group_confirmation_text: form.large_group_confirmation_text,
      large_group_cancellation_terms: form.large_group_cancellation_terms,
      noshow_deposit_rules_prepared: form.noshow_deposit_rules_prepared,
      transfer_phone: form.transfer_phone.trim() === "" ? null : form.transfer_phone.trim(),
      transfer_hours_start: form.transfer_hours_start === "" ? null : form.transfer_hours_start,
      transfer_hours_end: form.transfer_hours_end === "" ? null : form.transfer_hours_end,
    };
    const { error } = await supabase.from("restaurants").update(payload as any).eq("id", restaurantId);
    setSaving(false);
    if (error) {
      toast.error("Opslaan mislukt: " + error.message);
      return;
    }
    toast.success("Grote-groepeninstellingen opgeslagen.");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Laden…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl">Grote groepen</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Grotere groepen vragen vaak meer voorbereiding. Stel hier in vanaf wanneer je extra tijd, goedkeuring of een reserveringsgarantie wilt gebruiken.
      </p>

      {(() => {
        const base = form.default_reservation_minutes;
        const largeDur = Math.max(form.large_group_minutes, base);
        const xlOn = form.extra_large_group_threshold !== "" && Number(form.extra_large_group_threshold) > form.large_group_threshold;
        const xlDur = largeDur + (xlOn ? Number(form.large_group_extra_minutes) : 0);
        const xlFrom = xlOn ? Number(form.extra_large_group_threshold) : null;
        const maxOnline = form.large_group_max_online_request === "" ? null : Number(form.large_group_max_online_request);
        return (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80 space-y-1">
            <div><strong>Live preview</strong> (standaardduur: {base} min)</div>
            <div>• 1 – {form.large_group_threshold - 1} pers.: normale reservering ({base} min)</div>
            <div>• {form.large_group_threshold}{xlFrom ? ` – ${xlFrom - 1}` : "+"} pers.: grote groep ({largeDur} min){form.large_group_manual_approval_from > form.large_group_threshold ? `, handmatige goedkeuring vanaf ${form.large_group_manual_approval_from}` : ", altijd handmatige goedkeuring"}</div>
            {xlFrom && <div>• {xlFrom}+ pers.: extra-grote groep ({xlDur} min), altijd handmatige goedkeuring</div>}
            {maxOnline && <div>• Boven {maxOnline} pers.: niet via widget/voice agent — losse aanvraag of doorverbinden</div>}
          </div>
        );
      })()}

      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-medium">A. Wanneer is het een grote groep?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Grote groep vanaf (personen)" hint="Vanaf dit aantal wordt een reservering als grote groep behandeld (langere verblijfsduur, eventueel handmatige goedkeuring).">
              <Input type="number" min={1} value={form.large_group_threshold}
                onChange={(e) => setForm({ ...form, large_group_threshold: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Verblijfsduur grote groep (min)" hint={`Totale verblijfsduur die geldt zodra de drempel hierboven wordt bereikt. Standaardduur is ${form.default_reservation_minutes} min — kies hier de tijd voor grote groepen (bv. 150).`}>
              <Input type="number" min={form.default_reservation_minutes} step={5} value={form.large_group_minutes}
                onChange={(e) => setForm({ ...form, large_group_minutes: Number(e.target.value) || form.default_reservation_minutes })} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-medium">B. Wanneer is het een extra-grote groep? <span className="text-xs font-normal text-muted-foreground">(optioneel)</span></h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Extra-grote groep vanaf (personen)" hint='Optionele tweede drempel. Boven dit aantal wordt nóg meer verblijfsduur toegekend en is goedkeuring altijd verplicht. Laat leeg om uit te schakelen.'>
              <Input type="number" min={1} placeholder="bv. 19"
                value={form.extra_large_group_threshold}
                onChange={(e) => setForm({ ...form, extra_large_group_threshold: e.target.value === "" ? "" : (Number(e.target.value) || 1) })} />
            </Field>
            <Field label="Extra verblijfsduur extra-grote groep (min)" hint="Wordt bovenop de verblijfsduur grote groep opgeteld zodra de tweede drempel wordt bereikt.">
              <Input type="number" min={0} step={5} value={form.large_group_extra_minutes}
                disabled={form.extra_large_group_threshold === ""}
                onChange={(e) => setForm({ ...form, large_group_extra_minutes: Number(e.target.value) || 0 })} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-medium">C. Goedkeuring & online limieten</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Handmatige goedkeuring vanaf (personen)" hint="Vanaf dit aantal moet jij de reservering eerst goedkeuren. Onder dit aantal (maar boven 'grote groep vanaf') wordt automatisch geboekt met de langere verblijfsduur. Extra-grote groepen zijn áltijd handmatig, ongeacht deze waarde.">
              <Input type="number" min={1} value={form.large_group_manual_approval_from}
                onChange={(e) => setForm({ ...form, large_group_manual_approval_from: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Maximale online groepsaanvraag (personen)" hint="Harde bovengrens voor widget én voice agent. Boven dit aantal kan de gast niet zelf boeken: widget toont groepsformulier, voice agent verbindt door (binnen call-transfer venster) of noteert de aanvraag als groepsverzoek.">
              <Input type="number" min={1} placeholder="bv. 18"
                value={form.large_group_max_online_request}
                onChange={(e) => setForm({ ...form, large_group_max_online_request: e.target.value === "" ? "" : (Number(e.target.value) || 1) })} />
            </Field>
            <Field label="Toelichting verplicht vanaf (personen)" hint="Vanaf dit aantal moet de gast in de widget een korte toelichting meesturen (gelegenheid, menuwens, etc.). Laat leeg om nooit te verplichten.">
              <Input type="number" min={1} placeholder={`bv. ${form.large_group_threshold}`}
                value={form.large_group_extra_info_from}
                onChange={(e) => setForm({ ...form, large_group_extra_info_from: e.target.value === "" ? "" : (Number(e.target.value) || 1) })} />
            </Field>
            <Field label="Aanbetaling aanbevolen vanaf (personen)" hint="Bij dit aantal toont TableWise een suggestie om een aanbetaling te vragen.">
              <Input type="number" min={1} value={form.large_group_deposit_recommended_from}
                onChange={(e) => setForm({ ...form, large_group_deposit_recommended_from: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Standaardstatus voor groepsaanvraag" hint="Welke status krijgt een grote-groepsreservering die op goedkeuring wacht.">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.large_group_default_status}
                onChange={(e) => setForm({ ...form, large_group_default_status: e.target.value })}
              >
                <option value="pending">In afwachting</option>
                <option value="hold">Voorlopig</option>
              </select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-medium">Communicatie naar gast</h3>
          <Field label="Bevestigingstekst voor groepsreservering" hint="Komt straks in de bevestigingsmail van ClickWise. Optioneel.">
            <Textarea rows={3} value={form.large_group_confirmation_text}
              onChange={(e) => setForm({ ...form, large_group_confirmation_text: e.target.value })}
              placeholder="Bijv. 'Bedankt voor je groepsreservering. We nemen binnen 24 uur persoonlijk contact op om alles af te stemmen.'" />
          </Field>
          <Field label="Annuleringsvoorwaarden" hint="Korte tekst over jouw annuleringsbeleid voor groepen.">
            <Textarea rows={3} value={form.large_group_cancellation_terms}
              onChange={(e) => setForm({ ...form, large_group_cancellation_terms: e.target.value })}
              placeholder="Bijv. 'Annuleren of wijzigen kan kosteloos tot 48 uur voor aanvang.'" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-medium">Reserveringsgarantie (voorbereid)</h3>
          <p className="text-xs text-muted-foreground inline-flex items-start gap-1">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Echte aanbetalingen via een betaalprovider komen later. Schakel hier in dat je beleid alvast voorbereid is — TableWise toont dan signalen op de juiste plekken.
          </p>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="font-medium text-sm">Aanbetalingsregels voorbereid</div>
              <div className="text-xs text-muted-foreground">Toont 'Aanbetaling gewenst' op grote-groep aanvragen.</div>
            </div>
            <Switch
              checked={form.noshow_deposit_rules_prepared}
              onCheckedChange={(v) => setForm({ ...form, noshow_deposit_rules_prepared: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-medium">Call Transfer bij te grote groepen</h3>
          <p className="text-xs text-muted-foreground inline-flex items-start gap-1">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Wanneer een beller via de AI Voice Agent een groep aanvraagt die groter is dan "Maximale online groepsaanvraag", verbindt de agent door naar dit nummer — maar alléén binnen het venster hieronder. Buiten dit venster (of op gesloten dagen) noteert de agent de aanvraag als groepsverzoek (zichtbaar in Grote groepen).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Doorverbind-nummer" hint="E.164 formaat, bv. +31612345678.">
              <Input type="tel" placeholder="+31612345678"
                value={form.transfer_phone}
                onChange={(e) => setForm({ ...form, transfer_phone: e.target.value })} />
            </Field>
            <Field label="Venster start" hint="Vanaf deze tijd mag worden doorverbonden.">
              <Input type="time" value={form.transfer_hours_start}
                onChange={(e) => setForm({ ...form, transfer_hours_start: e.target.value })} />
            </Field>
            <Field label="Venster eind" hint="Tot deze tijd mag worden doorverbonden.">
              <Input type="time" value={form.transfer_hours_end}
                onChange={(e) => setForm({ ...form, transfer_hours_end: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            De beslissing wordt server-side genomen in jouw tijdzone — de AI kan dus niet per ongeluk midden in de nacht doorverbinden.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="h-11 min-w-32">
          {saving ? "Opslaan…" : "Opslaan"}
        </Button>
      </div>
    </div>
  );
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default LargeGroupSettings;
