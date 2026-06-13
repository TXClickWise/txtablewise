import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdvancedSection } from "@/components/AdvancedSection";
import { toast } from "sonner";
import { Sparkles, Shield, Heart, Check } from "lucide-react";
import CapacitySettings from "./CapacitySettings";
import LargeGroupSettings from "./LargeGroupSettings";
import NoShowSettings from "./NoShowSettings";
import GuestChangesSettings from "./GuestChangesSettings";

type PresetKey = "aanbevolen" | "streng" | "soepel";

type Preset = {
  key: PresetKey;
  label: string;
  description: string;
  icon: typeof Sparkles;
  values: Record<string, unknown>;
};

const PRESETS: Preset[] = [
  {
    key: "aanbevolen",
    label: "Aanbevolen",
    description: "Goede balans: bevestigingen, reminders 24u en 2u vooraf, gastvrije annulering tot 3 uur ervoor.",
    icon: Sparkles,
    values: {
      noshow_confirmation_enabled: true,
      noshow_reminder_24h_enabled: true,
      noshow_reminder_2h_enabled: true,
      noshow_reconfirm_enabled: false,
      noshow_reconfirmation_hours_before: 24,
      noshow_cancellation_cutoff_minutes: 180,
      noshow_guest_cancel_link_enabled: true,
      noshow_auto_mark_enabled: true,
      noshow_auto_mark_grace_minutes: 20,
    },
  },
  {
    key: "streng",
    label: "Streng tegen no-shows",
    description: "Extra herbevestiging 4u vooraf, korte annuleringstermijn (1u), automatische no-show na 15 min.",
    icon: Shield,
    values: {
      noshow_confirmation_enabled: true,
      noshow_reminder_24h_enabled: true,
      noshow_reminder_2h_enabled: true,
      noshow_reconfirm_enabled: true,
      noshow_reconfirmation_hours_before: 4,
      noshow_cancellation_cutoff_minutes: 60,
      noshow_guest_cancel_link_enabled: true,
      noshow_auto_mark_enabled: true,
      noshow_auto_mark_grace_minutes: 15,
    },
  },
  {
    key: "soepel",
    label: "Soepel — gastvrije focus",
    description: "Eén reminder 24u vooraf, ruime annuleringstermijn (24u), geen automatische no-show.",
    icon: Heart,
    values: {
      noshow_confirmation_enabled: true,
      noshow_reminder_24h_enabled: true,
      noshow_reminder_2h_enabled: false,
      noshow_reconfirm_enabled: false,
      noshow_reconfirmation_hours_before: 24,
      noshow_cancellation_cutoff_minutes: 1440,
      noshow_guest_cancel_link_enabled: true,
      noshow_auto_mark_enabled: false,
      noshow_auto_mark_grace_minutes: 30,
    },
  },
];

export default function ReservationRulesSettings() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const [applying, setApplying] = useState<PresetKey | null>(null);
  const [appliedKey, setAppliedKey] = useState<PresetKey | null>(null);

  const apply = async (preset: Preset) => {
    if (!restaurantId) return;
    setApplying(preset.key);
    const { error } = await supabase
      .from("restaurants")
      .update(preset.values as never)
      .eq("id", restaurantId);
    setApplying(null);
    if (error) {
      toast.error("Niet opgeslagen: " + error.message);
      return;
    }
    setAppliedKey(preset.key);
    toast.success(`Preset "${preset.label}" toegepast — je kunt onderaan finetunen indien gewenst.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl mb-1">Reserveringen</h1>
        <p className="text-sm text-muted-foreground">
          Kies één van de drie aanbevolen instellingen — dat dekt 95% van de horeca. Wil je iets specifieks aanpassen?
          Open onderaan "Geavanceerd aanpassen".
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PRESETS.map((p) => {
          const Icon = p.icon;
          const isApplied = appliedKey === p.key;
          const isBusy = applying === p.key;
          return (
            <Card
              key={p.key}
              className={isApplied ? "border-primary ring-1 ring-primary/30" : ""}
            >
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{p.label}</CardTitle>
                  {isApplied && (
                    <Badge variant="outline" className="ml-auto gap-1 text-xs">
                      <Check className="h-3 w-3" /> Actief
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs leading-relaxed">
                  {p.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant={isApplied ? "outline" : "default"}
                  size="sm"
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => apply(p)}
                >
                  {isBusy ? "Toepassen…" : isApplied ? "Opnieuw toepassen" : "Toepassen"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AdvancedSection
        title="Geavanceerd aanpassen"
        description="Pas elk veld zelf aan: capaciteit, grote groepen, no-show regels en gastwijzigingen."
      >
        <Tabs defaultValue="capacity">
          <TabsList>
            <TabsTrigger value="capacity">Capaciteit</TabsTrigger>
            <TabsTrigger value="large">Grote groepen</TabsTrigger>
            <TabsTrigger value="noshow">No-show regels</TabsTrigger>
            <TabsTrigger value="guest_changes">Gastwijzigingen</TabsTrigger>
          </TabsList>
          <TabsContent value="capacity" className="mt-4">
            <CapacitySettings />
          </TabsContent>
          <TabsContent value="large" className="mt-4">
            <LargeGroupSettings />
          </TabsContent>
          <TabsContent value="noshow" className="mt-4">
            <NoShowSettings />
          </TabsContent>
          <TabsContent value="guest_changes" className="mt-4">
            <GuestChangesSettings />
          </TabsContent>
        </Tabs>
      </AdvancedSection>
    </div>
  );
}
