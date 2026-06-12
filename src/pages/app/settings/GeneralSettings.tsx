import { useEffect, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useAdvancedMode } from "@/hooks/useAdvancedMode";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ExternalLink, Copy, Wrench } from "lucide-react";
import { getWidgetUrl } from "@/lib/widgetUrl";
import { WeatherSettingsCard } from "@/components/weather/WeatherSettingsCard";

export default function GeneralSettings() {
  const { current } = useRestaurant();
  const advanced = useAdvancedMode();
  const [advancedSaving, setAdvancedSaving] = useState(false);
  const r = current?.restaurants;
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address_line1: "", postal_code: "", city: "",
    slot_duration_minutes: 15, default_reservation_minutes: 105,
    booking_lead_time_minutes: 60, hold_minutes: 10, booking_horizon_days: 90,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!r) return;
    setForm({
      name: r.name ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      address_line1: r.address_line1 ?? "",
      postal_code: r.postal_code ?? "",
      city: r.city ?? "",
      slot_duration_minutes: r.slot_duration_minutes ?? 15,
      default_reservation_minutes: r.default_reservation_minutes ?? 105,
      booking_lead_time_minutes: r.booking_lead_time_minutes ?? 60,
      hold_minutes: r.hold_minutes ?? 10,
      booking_horizon_days: r.booking_horizon_days ?? 90,
    });
  }, [r]);

  if (!r) return null;
  const url = getWidgetUrl(r.slug, {
    customWidgetDomain: (r as any).custom_widget_domain,
    publicBaseUrl: (r as any).public_base_url,
  });

  const onSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("restaurants").update(form).eq("id", r.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Opgeslagen");
  };

  const numField = (key: keyof typeof form, label: string, hint?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={form[key] as number}
        onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) || 0 })}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Publieke reserveringspagina</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input readOnly value={url} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(url); toast.success("Gekopieerd"); }}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Restaurant gegevens</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1 sm:col-span-2"><Label>Naam</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Telefoon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Adres</Label><Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} /></div>
          <div className="space-y-1"><Label>Postcode</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
          <div className="space-y-1"><Label>Plaats</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
        </CardContent>
      </Card>

      <WeatherSettingsCard />

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Reserveringen</CardTitle>
          <CardDescription>
            Groepslimieten (grote groep vanaf, max online groep) staan onder{" "}
            <strong>Instellingen → Reserveringen → Grote groepen</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          {numField("slot_duration_minutes", "Slot lengte (min)", "Stappen voor tijdslots")}
          {numField("default_reservation_minutes", "Standaard duur (min)", "Tijd per reservering")}
          {numField("hold_minutes", "Hold (min)", "Voorlopige reservering")}
          {numField("booking_lead_time_minutes", "Lead time (min)", "Min. tijd voor reservering")}
          {numField("booking_horizon_days", "Horizon (dagen)", "Hoe ver vooruit boeken")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Geavanceerde modus
          </CardTitle>
          <CardDescription>
            Toon technische opties zoals webhooks, integratie-logs, API-mappings en raw payloads.
            Voor de meeste restaurants niet nodig.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Geavanceerde opties tonen</Label>
              <p className="text-xs text-muted-foreground">
                {advanced.isAdmin
                  ? "Je bent system admin — je ziet altijd alles, ongeacht deze schakelaar."
                  : advanced.enabled
                    ? "Aan: technische menu's en knoppen zijn zichtbaar."
                    : "Uit: TableWise toont alleen wat je dagelijks nodig hebt."}
              </p>
            </div>
            <Switch
              checked={advanced.enabled}
              disabled={advancedSaving}
              onCheckedChange={async (next) => {
                setAdvancedSaving(true);
                const res = await advanced.setEnabled(next);
                setAdvancedSaving(false);
                if (!res.ok) toast.error("Opslaan mislukt: " + res.error);
                else toast.success(next ? "Geavanceerde modus aan" : "Geavanceerde modus uit");
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button>
      </div>
    </div>
  );
}
