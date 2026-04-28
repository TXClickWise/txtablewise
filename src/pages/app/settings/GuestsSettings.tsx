import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Users, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function GuestsSettings() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();

  const { data: r } = useQuery({
    queryKey: ["restaurant-settings", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId!)
        .maybeSingle();
      return data;
    },
  });

  const patch = async (values: Record<string, any>) => {
    if (!restaurantId) return;
    const { error } = await supabase
      .from("restaurants")
      .update(values as any)
      .eq("id", restaurantId);
    if (error) toast.error("Opslaan mislukt: " + error.message);
    else qc.invalidateQueries({ queryKey: ["restaurant-settings", restaurantId] });
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
      <div>
        <h1 className="font-display text-2xl mb-1">Gasten</h1>
        <p className="text-sm text-muted-foreground">
          Hoe gaan we om met gastdata, voorkeuren en notities. Hospitality-first — geen
          bestraffende labels.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="font-medium mb-2">Wat de gast mag delen</h2>
        <div className="divide-y divide-border">
          <Toggle
            label="Opmerkingen en allergieën toestaan"
            field="allow_guest_notes"
          />
          <Toggle
            label="Zonevoorkeur (binnen/terras) toestaan"
            field="allow_zone_preference"
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h2 className="font-medium">Gastenoverzicht</h2>
              <p className="text-sm text-muted-foreground">
                Bekijk en beheer je hospitality-CRM met visit history en voorkeuren.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to="/app/gasten">
              Openen <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
