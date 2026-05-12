// GuestChangesSettings — operator-facing tab to configure how guest-initiated
// reservation changes are handled (auto-apply, min notice, large-group threshold).

import { useEffect, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Info, UserCog } from "lucide-react";

type Form = {
  guest_changes_auto_apply: boolean;
  guest_changes_min_notice_minutes: number;
  guest_changes_auto_reject_party_size: number | "";
};

const defaults: Form = {
  guest_changes_auto_apply: true,
  guest_changes_min_notice_minutes: 120,
  guest_changes_auto_reject_party_size: "",
};

export default function GuestChangesSettings() {
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
        .select("guest_changes_auto_apply,guest_changes_min_notice_minutes,guest_changes_auto_reject_party_size")
        .eq("id", restaurantId)
        .maybeSingle();
      if (data) {
        setForm({
          guest_changes_auto_apply: data.guest_changes_auto_apply ?? defaults.guest_changes_auto_apply,
          guest_changes_min_notice_minutes: data.guest_changes_min_notice_minutes ?? defaults.guest_changes_min_notice_minutes,
          guest_changes_auto_reject_party_size: data.guest_changes_auto_reject_party_size ?? "",
        });
      }
      setLoading(false);
    })();
  }, [restaurantId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!restaurantId) return;
    if (form.guest_changes_min_notice_minutes < 0) return toast.error("Wachttijd mag niet negatief zijn.");
    if (form.guest_changes_auto_reject_party_size !== "" && form.guest_changes_auto_reject_party_size < 1) return toast.error("Drempel moet minimaal 1 zijn.");
    setSaving(true);
    const payload = {
      ...form,
      guest_changes_auto_reject_party_size: form.guest_changes_auto_reject_party_size === "" ? null : form.guest_changes_auto_reject_party_size,
    };
    const { error } = await supabase.from("restaurants").update(payload).eq("id", restaurantId);
    setSaving(false);
    if (error) return toast.error("Niet opgeslagen: " + error.message);
    await supabase.from("audit_log").insert({
      restaurant_id: restaurantId,
      actor_label: "operator",
      action: "guest_changes_settings.updated",
      entity: "restaurant",
      entity_id: restaurantId,
      after_data: payload,
    });
    toast.success("Instellingen opgeslagen");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Laden…</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 flex gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            Gasten kunnen zelf hun reservering wijzigen via de bevestigingslink (datum/tijd, aantal personen,
            contactgegevens, dieetwensen). Het systeem keurt direct goed wat past binnen jullie regels en
            tafelbeschikbaarheid. Wat niet automatisch kan, komt bij jullie team terecht.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            <h3 className="font-medium">Automatische verwerking</h3>
          </div>
          <div className="flex items-start justify-between gap-4 py-1">
            <div>
              <div className="text-sm font-medium">Wijzigingen automatisch goedkeuren</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Wanneer beschikbaarheid en regels het toelaten, voeren we de wijziging direct door en sturen we een bevestiging.
              </div>
            </div>
            <Switch checked={form.guest_changes_auto_apply} onCheckedChange={(v) => set("guest_changes_auto_apply", v)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Minimale termijn vóór reservering (minuten)</Label>
              <Input
                type="number" min={0}
                value={form.guest_changes_min_notice_minutes}
                onChange={(e) => set("guest_changes_min_notice_minutes", parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Wijzigingen binnen deze termijn worden niet automatisch verwerkt.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Altijd handmatig vanaf (aantal personen)</Label>
              <Input
                type="number" min={1}
                placeholder="Geen drempel"
                value={form.guest_changes_auto_reject_party_size}
                onChange={(e) => set("guest_changes_auto_reject_party_size", e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">Optioneel. Leeg laten betekent: geen extra groepsdrempel voor gastwijzigingen.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button>
      </div>
    </div>
  );
}
