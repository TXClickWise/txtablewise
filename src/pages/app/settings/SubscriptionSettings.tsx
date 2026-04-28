import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Mail } from "lucide-react";

export default function SubscriptionSettings() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;

  const { data: r } = useQuery({
    queryKey: ["restaurant-settings", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("name, plan_type, is_active, created_at")
        .eq("id", restaurantId!)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl mb-1">Abonnement</h1>
        <p className="text-sm text-muted-foreground">
          TableWise is commissie-vrij. Eén vast tarief, geen provisie per reservering.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-medium">{r?.name ?? "—"}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="capitalize">
                  {r?.plan_type ?? "Pilot"}
                </Badge>
                {r?.is_active && (
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10">
                    Actief
                  </Badge>
                )}
              </div>
              {r?.created_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Klant sinds {new Date(r.created_at).toLocaleDateString("nl-NL")}
                </p>
              )}
            </div>
          </div>
          <Button asChild variant="outline">
            <a href="mailto:hello@tablewise.nl">
              <Mail className="h-4 w-4 mr-2" />
              Plan wijzigen
            </a>
          </Button>
        </div>
      </Card>
    </div>
  );
}
