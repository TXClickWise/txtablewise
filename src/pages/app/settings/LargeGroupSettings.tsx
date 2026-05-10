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
  large_group_extra_minutes: number;
  large_group_manual_approval_from: number;
  large_group_deposit_recommended_from: number;
  large_group_auto_book_max: number;
  large_group_extra_info_from: number | "";
  large_group_max_online_request: number | "";
  large_group_default_status: string;
  large_group_confirmation_text: string;
  large_group_cancellation_terms: string;
  noshow_deposit_rules_prepared: boolean;
};

const defaults: Form = {
  large_group_threshold: 8,
  large_group_extra_minutes: 30,
  large_group_manual_approval_from: 10,
  large_group_deposit_recommended_from: 8,
  large_group_auto_book_max: 12,
  large_group_extra_info_from: "",
  large_group_max_online_request: "",
  large_group_default_status: "pending",
  large_group_confirmation_text: "",
  large_group_cancellation_terms: "",
  noshow_deposit_rules_prepared: false,
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
          large_group_threshold, large_group_extra_minutes, large_group_manual_approval_from,
          large_group_deposit_recommended_from, large_group_auto_book_max, large_group_default_status,
          large_group_confirmation_text, large_group_cancellation_terms, noshow_deposit_rules_prepared
        `)
        .eq("id", restaurantId).maybeSingle();
      if (data) {
        setForm({
          large_group_threshold: data.large_group_threshold ?? defaults.large_group_threshold,
          large_group_extra_minutes: data.large_group_extra_minutes ?? defaults.large_group_extra_minutes,
          large_group_manual_approval_from: data.large_group_manual_approval_from ?? defaults.large_group_manual_approval_from,
          large_group_deposit_recommended_from: data.large_group_deposit_recommended_from ?? defaults.large_group_deposit_recommended_from,
          large_group_auto_book_max: data.large_group_auto_book_max ?? defaults.large_group_auto_book_max,
          large_group_default_status: data.large_group_default_status ?? defaults.large_group_default_status,
          large_group_confirmation_text: data.large_group_confirmation_text ?? "",
          large_group_cancellation_terms: data.large_group_cancellation_terms ?? "",
          noshow_deposit_rules_prepared: data.noshow_deposit_rules_prepared ?? false,
        });
      }
      setLoading(false);
    })();
  }, [restaurantId]);

  const save = async () => {
    if (!restaurantId) return;
    setSaving(true);
    const { error } = await supabase.from("restaurants").update(form).eq("id", restaurantId);
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

      <Card>
        <CardContent className="p-5 space-y-5">
          <h3 className="font-medium">Drempels</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Grote groep vanaf (personen)" hint="Vanaf dit aantal wordt een reservering als grote groep gemarkeerd.">
              <Input type="number" min={1} value={form.large_group_threshold}
                onChange={(e) => setForm({ ...form, large_group_threshold: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Extra verblijfsduur (minuten)" hint="Wordt boven op de standaardduur opgeteld voor grote groepen.">
              <Input type="number" min={0} step={5} value={form.large_group_extra_minutes}
                onChange={(e) => setForm({ ...form, large_group_extra_minutes: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Handmatige goedkeuring vanaf" hint="Vanaf dit aantal vraagt de reservering om jouw goedkeuring vóór bevestiging.">
              <Input type="number" min={1} value={form.large_group_manual_approval_from}
                onChange={(e) => setForm({ ...form, large_group_manual_approval_from: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Aanbetaling aanbevolen vanaf" hint="Bij dit aantal toont TableWise een suggestie om een aanbetaling te vragen.">
              <Input type="number" min={1} value={form.large_group_deposit_recommended_from}
                onChange={(e) => setForm({ ...form, large_group_deposit_recommended_from: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Automatisch boeken tot (personen)" hint="Boven dit aantal worden aanvragen altijd handmatig beoordeeld.">
              <Input type="number" min={1} value={form.large_group_auto_book_max}
                onChange={(e) => setForm({ ...form, large_group_auto_book_max: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Standaardstatus voor groepsaanvraag" hint="Welke status krijgt een grote-groepsreservering die handmatige goedkeuring nodig heeft.">
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
