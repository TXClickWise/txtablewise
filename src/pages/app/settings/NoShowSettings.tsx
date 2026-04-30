// NoShowSettings — operator-facing tab to configure no-show prevention.
// All fields map directly to columns on `restaurants`. No real channel sending
// happens yet — toggles only set up the structure for ClickWise workflows later.

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
import { ShieldCheck, Wallet, MailCheck, Info } from "lucide-react";
import { AdvancedSection } from "@/components/AdvancedSection";

type Form = {
  // Confirmation & reminders
  noshow_confirmation_enabled: boolean;
  noshow_reminder_24h_enabled: boolean;
  noshow_reminder_2h_enabled: boolean;
  noshow_reconfirm_enabled: boolean;
  noshow_reconfirmation_hours_before: number;
  noshow_cancellation_cutoff_minutes: number;
  noshow_guest_cancel_link_enabled: boolean;
  noshow_risk_signal_enabled: boolean;
  noshow_cancel_message: string;
  // Deposits
  noshow_deposit_rules_prepared: boolean;
  deposit_default_amount_cents: number;
  deposit_voucher_credit_possible: boolean;
  deposit_exempt_vip: boolean;
  deposit_exempt_regulars: boolean;
  deposit_guest_message: string;
};

const defaults: Form = {
  noshow_confirmation_enabled: true,
  noshow_reminder_24h_enabled: true,
  noshow_reminder_2h_enabled: true,
  noshow_reconfirm_enabled: true,
  noshow_reconfirmation_hours_before: 24,
  noshow_cancellation_cutoff_minutes: 120,
  noshow_guest_cancel_link_enabled: true,
  noshow_risk_signal_enabled: true,
  noshow_cancel_message: "",
  noshow_deposit_rules_prepared: false,
  deposit_default_amount_cents: 1000,
  deposit_voucher_credit_possible: true,
  deposit_exempt_vip: true,
  deposit_exempt_regulars: true,
  deposit_guest_message: "",
};

const NoShowSettings = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const [form, setForm] = useState<Form>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      const { data } = await supabase
        .from("restaurants")
        .select(
          "noshow_confirmation_enabled,noshow_reminder_24h_enabled,noshow_reminder_2h_enabled,noshow_reconfirm_enabled,noshow_reconfirmation_hours_before,noshow_cancellation_cutoff_minutes,noshow_guest_cancel_link_enabled,noshow_risk_signal_enabled,noshow_cancel_message,noshow_deposit_rules_prepared,deposit_default_amount_cents,deposit_voucher_credit_possible,deposit_exempt_vip,deposit_exempt_regulars,deposit_guest_message",
        )
        .eq("id", restaurantId)
        .maybeSingle();
      if (data) setForm({ ...defaults, ...(data as unknown as Partial<Form>) });
      setLoading(false);
    })();
  }, [restaurantId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!restaurantId) return;
    if (form.noshow_reconfirmation_hours_before < 0) return toast.error("Herbevestigingstermijn mag niet negatief zijn.");
    if (form.noshow_cancellation_cutoff_minutes < 0) return toast.error("Annuleringstermijn mag niet negatief zijn.");
    if (form.deposit_default_amount_cents < 0) return toast.error("Bedrag mag niet negatief zijn.");

    setSaving(true);
    const { error } = await supabase.from("restaurants").update(form).eq("id", restaurantId);
    setSaving(false);
    if (error) return toast.error("Niet opgeslagen: " + error.message);

    await supabase.from("audit_log").insert({
      restaurant_id: restaurantId,
      actor_label: "operator",
      action: "no_show_settings.updated",
      entity: "restaurant",
      entity_id: restaurantId,
      after_data: form,
    });
    toast.success("Instellingen opgeslagen");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Laden…</div>;

  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card>
        <CardContent className="pt-6 flex gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            Met vriendelijke bevestigingen en reminders voorkom je lege tafels zonder ongastvrij over te komen.
            Echte verzending via WhatsApp/SMS/e-mail loopt later via ClickWise.
          </div>
        </CardContent>
      </Card>

      {/* Confirmations & reminders */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-primary" />
            <h3 className="font-medium">Bevestigingen & reminders</h3>
          </div>
          <ToggleRow
            checked={form.noshow_confirmation_enabled}
            onChange={(v) => set("noshow_confirmation_enabled", v)}
            title="Automatische bevestiging"
            help="Bereidt direct na de reservering een bevestiging voor (later via ClickWise verstuurd)."
          />
          <ToggleRow
            checked={form.noshow_reminder_24h_enabled}
            onChange={(v) => set("noshow_reminder_24h_enabled", v)}
            title="Reminder 24 uur vooraf"
          />
          <ToggleRow
            checked={form.noshow_reminder_2h_enabled}
            onChange={(v) => set("noshow_reminder_2h_enabled", v)}
            title="Reminder 2 uur vooraf"
          />
          <ToggleRow
            checked={form.noshow_reconfirm_enabled}
            onChange={(v) => set("noshow_reconfirm_enabled", v)}
            title="Herbevestiging vragen"
            help="Vraag de gast actief om te bevestigen of zij komen."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Herbevestiging X uur vooraf">
              <Input
                type="number" min={0}
                value={form.noshow_reconfirmation_hours_before}
                onChange={(e) => set("noshow_reconfirmation_hours_before", parseInt(e.target.value) || 0)}
              />
            </Field>
            <Field label="Annuleringstermijn (minuten)">
              <Input
                type="number" min={0}
                value={form.noshow_cancellation_cutoff_minutes}
                onChange={(e) => set("noshow_cancellation_cutoff_minutes", parseInt(e.target.value) || 0)}
              />
            </Field>
          </div>
          <ToggleRow
            checked={form.noshow_guest_cancel_link_enabled}
            onChange={(v) => set("noshow_guest_cancel_link_enabled", v)}
            title="Makkelijke annulering via gastlink"
            help="Geef gasten een veilige link om hun reservering zelf te bevestigen of te annuleren."
          />
          <ToggleRow
            checked={form.noshow_risk_signal_enabled}
            onChange={(v) => set("noshow_risk_signal_enabled", v)}
            title="No-show risicosignaal tonen"
            help="Intern signaal voor medewerkers — wordt nooit aan de gast getoond."
          />
          <Field label="Bericht bij annulering door gast (preview)">
            <Textarea
              rows={3}
              placeholder="Bijv. ‘Bedankt voor het doorgeven. We hopen je een andere keer te mogen ontvangen.’"
              value={form.noshow_cancel_message}
              onChange={(e) => set("noshow_cancel_message", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Deposits */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h3 className="font-medium">Reserveringsgarantie</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Voor grotere groepen of piekmomenten kun je een reserveringsgarantie vragen. Zo weet je zeker dat de tafel goed voorbereid kan worden.
            Echte betaling is nog niet actief — dit bereidt de regels en gasttekst voor.
          </p>
          <ToggleRow
            checked={form.noshow_deposit_rules_prepared}
            onChange={(v) => set("noshow_deposit_rules_prepared", v)}
            title="Regels voor reserveringsgarantie voorbereid"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Standaard bedrag per gast (€)">
              <Input
                type="number" min={0} step={0.5}
                value={(form.deposit_default_amount_cents / 100).toString()}
                onChange={(e) =>
                  set("deposit_default_amount_cents", Math.round((parseFloat(e.target.value) || 0) * 100))
                }
              />
            </Field>
          </div>
          <ToggleRow
            checked={form.deposit_voucher_credit_possible}
            onChange={(v) => set("deposit_voucher_credit_possible", v)}
            title="Tegoedbon mogelijk i.p.v. boete"
            help="Bij no-show kan het bedrag als tegoedbon worden gegeven — gastvrijer dan een harde boete."
          />
          <ToggleRow
            checked={form.deposit_exempt_vip}
            onChange={(v) => set("deposit_exempt_vip", v)}
            title="VIP gasten uitzonderen"
          />
          <ToggleRow
            checked={form.deposit_exempt_regulars}
            onChange={(v) => set("deposit_exempt_regulars", v)}
            title="Vaste gasten uitzonderen"
          />
          <Field label="Tekst richting gast">
            <Textarea
              rows={3}
              placeholder="Voor grotere groepen vragen we een kleine reserveringsgarantie, zodat we de tafel goed kunnen voorbereiden."
              value={form.deposit_guest_message}
              onChange={(e) => set("deposit_guest_message", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Templates preview */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="font-medium">Voorbeeldteksten (preview)</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Variabelen zoals {"{{date}}"} en {"{{time}}"} worden later via ClickWise gevuld.
          </p>
          <TemplatePreview title="Bevestiging">
            Bedankt voor je reservering bij {"{{restaurant_name}}"}. We zien je graag op {"{{date}}"} om {"{{time}}"} met {"{{party_size}}"} personen.
          </TemplatePreview>
          <TemplatePreview title="Reminder">
            We kijken uit naar je komst vandaag om {"{{time}}"}. Kun je toch niet komen? Laat het eenvoudig weten via je reserveringslink.
          </TemplatePreview>
          <TemplatePreview title="Herbevestiging">
            Kom je nog gezellig langs? Bevestig je reservering met één klik, dan houden we je tafel voor je vrij.
          </TemplatePreview>
          <TemplatePreview title="Reserveringsgarantie">
            Voor grotere groepen vragen we een kleine reserveringsgarantie, zodat we de tafel goed kunnen voorbereiden.
          </TemplatePreview>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Opslaan…" : "Opslaan"}
        </Button>
      </div>
    </div>
  );
};

const ToggleRow = ({
  checked, onChange, title, help,
}: { checked: boolean; onChange: (v: boolean) => void; title: string; help?: string }) => (
  <div className="flex items-start justify-between gap-4 py-1">
    <div>
      <div className="text-sm font-medium">{title}</div>
      {help && <div className="text-xs text-muted-foreground mt-0.5">{help}</div>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const TemplatePreview = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-md border border-border bg-muted/30 p-3">
    <div className="text-xs font-medium text-muted-foreground mb-1">{title}</div>
    <div className="text-sm">{children}</div>
  </div>
);

export default NoShowSettings;
