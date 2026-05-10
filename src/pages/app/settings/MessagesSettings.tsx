import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, MessageSquare, Mail } from "lucide-react";

export default function MessagesSettings() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();

  const { data: r } = useQuery({
    queryKey: ["restaurant-settings", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const patch = async (values: Record<string, any>) => {
    if (!restaurantId) return;
    const { error } = await supabase
      .from("restaurants")
      .update(values as any)
      .eq("id", restaurantId);
    if (error) {
      toast.error("Opslaan mislukt: " + error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["restaurant-settings", restaurantId] });
    qc.invalidateQueries({ queryKey: ["onboarding-step-statuses", restaurantId] });
  };

  if (!r) return <div className="text-muted-foreground p-4">Laden…</div>;

  const Toggle = ({
    label,
    description,
    field,
  }: {
    label: string;
    description?: string;
    field: string;
  }) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch
        checked={!!(r as any)[field]}
        onCheckedChange={(v) => patch({ [field]: v })}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-display text-xl mb-1">Bevestigingen & reminders</h2>
        <p className="text-sm text-muted-foreground mb-4">
          TableWise stuurt zelf geen WhatsApp/SMS — deze events triggeren je ClickWise-workflows.
        </p>
        <div className="divide-y divide-border">
          <Toggle
            label="Bevestiging direct na boeking"
            description="Stuur de gast een vriendelijke bevestiging zodra de reservering binnen is."
            field="noshow_confirmation_enabled"
          />
          <Toggle
            label="Reminder 24 uur vooraf"
            field="noshow_reminder_24h_enabled"
          />
          <Toggle
            label="Reminder 2 uur vooraf"
            field="noshow_reminder_2h_enabled"
          />
          <Toggle
            label="Herbevestiging vragen"
            description="Korte tap-to-confirm link kort voor het bezoek."
            field="noshow_reconfirm_enabled"
          />
          <Toggle
            label="Annuleren via gastlink"
            description="Maak afzeggen laagdrempelig — beter dan niet komen opdagen."
            field="noshow_guest_cancel_link_enabled"
          />
          <Toggle
            label="Aftercare na bezoek"
            description="Korte review-vraag, alleen na bevestigd bezoek."
            field="aftercare_enabled"
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-xl mb-1">Herbevestiging timing</h2>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <Label className="text-sm">Herbevestiging — uren vooraf</Label>
            <Input
              type="number"
              min={1}
              defaultValue={r.noshow_reconfirmation_hours_before ?? 24}
              onBlur={(e) =>
                patch({ noshow_reconfirmation_hours_before: parseInt(e.target.value) || 24 })
              }
            />
          </div>
          <div>
            <Label className="text-sm">Annuleer-cutoff — minuten vooraf</Label>
            <Input
              type="number"
              min={0}
              defaultValue={r.noshow_cancellation_cutoff_minutes ?? 120}
              onBlur={(e) =>
                patch({
                  noshow_cancellation_cutoff_minutes: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-xl mb-1">Gastvrije copy</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Optionele eigen tekst voor cancel-bericht. Laat leeg voor TableWise standaardtekst.
        </p>
        <Textarea
          rows={4}
          placeholder="Bijv: We rekenen op je. Plannen veranderd? Laat het ons gerust weten via de link."
          defaultValue={r.noshow_cancel_message ?? ""}
          onBlur={(e) => patch({ noshow_cancel_message: e.target.value })}
        />
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl mb-1">Testbericht</h2>
            <p className="text-sm text-muted-foreground">
              Plaatst een test-event in de wachtrij naar ClickWise.
            </p>
          </div>
          <Button
            onClick={async () => {
              if (!restaurantId) return;
              const { error } = await supabase.from("integration_events").insert({
                restaurant_id: restaurantId,
                event_type: "test_message",
                payload: { source: "settings_test", at: new Date().toISOString() },
              } as any);
              if (error) toast.error("Mislukt: " + error.message);
              else toast.success("Test-event verzonden");
            }}
          >
            <Send className="h-4 w-4 mr-2" />
            Stuur testbericht
          </Button>
        </div>
      </Card>
    </div>
  );
}
