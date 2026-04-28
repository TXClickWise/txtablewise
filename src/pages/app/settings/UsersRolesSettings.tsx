import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default function UsersRolesSettings() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;

  const { data: members } = useQuery({
    queryKey: ["restaurant-members", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurant_members")
        .select("id, role, user_id, created_at")
        .eq("restaurant_id", restaurantId!)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl mb-1">Gebruikers &amp; rollen</h1>
        <p className="text-sm text-muted-foreground">
          Wie heeft toegang tot dit restaurant en met welke rol.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-medium">Teamleden</h2>
        </div>
        {members && members.length > 0 ? (
          <div className="rounded-lg border border-border divide-y divide-border">
            {members.map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 text-sm"
              >
                <div className="font-mono text-xs text-muted-foreground">
                  {m.user_id.slice(0, 8)}…
                </div>
                <Badge variant="secondary" className="capitalize">
                  {m.role}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Nog geen leden.</p>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Nieuwe gebruikers uitnodigen komt in een latere fase. Neem voorlopig contact op
          met support om rollen aan te passen.
        </p>
      </Card>
    </div>
  );
}
