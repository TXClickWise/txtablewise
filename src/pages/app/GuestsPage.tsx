import { useRestaurant } from "@/hooks/useRestaurant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GuestsPage = () => {
  const { current } = useRestaurant();
  const { data: guests = [] } = useQuery({
    queryKey: ["guests", current?.restaurant_id],
    enabled: !!current,
    queryFn: async () => {
      const { data } = await supabase.from("guests")
        .select("*").eq("restaurant_id", current!.restaurant_id)
        .order("updated_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl">Gasten</h1>
        <p className="text-muted-foreground">{guests.length} profielen</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Recent</CardTitle></CardHeader>
        <CardContent>
          {guests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nog geen gasten in de database.</div>
          ) : (
            <div className="divide-y divide-border">
              {guests.map((g: never) => {
                const x = g as unknown as { id: string; first_name: string; last_name: string | null; email: string; phone: string | null; total_visits: number; is_vip: boolean; tags: string[] };
                return (
                  <div key={x.id} className="py-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-display text-sm">
                      {(x.first_name?.[0] ?? "G").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{x.first_name} {x.last_name ?? ""}</span>
                        {x.is_vip && <span className="text-xs bg-accent/30 text-accent-foreground px-1.5 py-0.5 rounded">VIP</span>}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{x.email} {x.phone && `· ${x.phone}`}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{x.total_visits} bezoeken</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default GuestsPage;
