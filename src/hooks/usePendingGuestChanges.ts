import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";

/**
 * Counts gast-wijzigingsverzoeken die nog beoordeeld moeten worden (status = 'new').
 */
export function usePendingGuestChanges() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["pending-guest-changes", restaurantId],
    enabled: !!restaurantId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("guest_change_requests")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId!)
        .eq("status", "new");
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!restaurantId) return;
    const channelName = `pending-guest-changes:${restaurantId}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guest_change_requests", filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ["pending-guest-changes", restaurantId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, qc]);

  return { count: query.data ?? 0, isLoading: query.isLoading };
}
