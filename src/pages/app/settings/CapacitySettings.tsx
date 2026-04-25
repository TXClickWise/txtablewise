import { useEffect, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Info } from "lucide-react";

type Form = {
  max_covers_per_slot: number | "";
  max_new_reservations_per_15min: number | "";
  peak_warning_threshold_pct: number;
  large_group_minutes: number;
};

export default function CapacitySettings() {
  const { current } = useRestaurant();
  const r = current?.restaurants;
  const [form, setForm] = useState<Form>({
    max_covers_per_slot: "",
    max_new_reservations_per_15min: "",
    peak_warning_threshold_pct: 85,
    large_group_minutes: 150,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!r) return;
    setForm({
      max_covers_per_slot: (r as any).max_covers_per_slot ?? "",
      max_new_reservations_per_15min: (r as any).max_new_reservations_per_15min ?? "",
      peak_warning_threshold_pct: (r as any).peak_warning_threshold_pct ?? 85,
      large_group_minutes: (r as any).large_group_minutes ?? 150,
    });
  }, [r]);

  if (!r) return null;

  const onSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("restaurants").update({
      max_covers_per_slot: form.max_covers_per_slot === "" ? null : Number(form.max_covers_per_slot),
      max_new_reservations_per_15min: form.max_new_reservations_per_15min === "" ? null : Number(form.max_new_reservations_per_15min),
      peak_warning_threshold_pct: Number(form.peak_warning_threshold_pct) || 85,
      large_group_minutes: Number(form.large_group_minutes) || 150,
    }).eq("id", r.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Capaciteits-instellingen opgeslagen");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Pacing & capaciteit</CardTitle>
          <CardDescription>
            Voorkom dat de keuken of bediening overspoeld raakt door te veel boekingen tegelijk.
            Laat een veld leeg om die limiet uit te schakelen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Max. covers per tijdslot</Label>
            <Input
              type="number"
              placeholder="bv. 40"
              value={form.max_covers_per_slot}
              onChange={(e) => setForm({ ...form, max_covers_per_slot: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">Totaal aantal gasten dat tegelijk aan tafel mag zitten.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max. nieuwe reserveringen per 15 min</Label>
            <Input
              type="number"
              placeholder="bv. 4"
              value={form.max_new_reservations_per_15min}
              onChange={(e) => setForm({ ...form, max_new_reservations_per_15min: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">Spreid drukte: hoeveel nieuwe groepen mogen binnen hetzelfde kwartier starten.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Piek-waarschuwing (% van capaciteit)</Label>
            <Input
              type="number"
              min={50}
              max={100}
              value={form.peak_warning_threshold_pct}
              onChange={(e) => setForm({ ...form, peak_warning_threshold_pct: parseInt(e.target.value) || 85 })}
            />
            <p className="text-xs text-muted-foreground">Vanaf dit niveau toont het systeem een drukte-indicator.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Verblijfsduur grote groep (min)</Label>
            <Input
              type="number"
              value={form.large_group_minutes}
              onChange={(e) => setForm({ ...form, large_group_minutes: parseInt(e.target.value) || 150 })}
            />
            <p className="text-xs text-muted-foreground">Geldt vanaf "grote groep"-drempel uit Algemeen.</p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border bg-muted/30 p-4 flex gap-3 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          Walk-ins en handmatige boekingen door medewerkers omzeilen deze limieten. Online boekingen worden geweigerd
          met een vriendelijke melding wanneer een tijdslot operationeel vol zit.
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button>
      </div>
    </div>
  );
}
