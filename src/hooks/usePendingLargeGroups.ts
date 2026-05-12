import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";

/**
 * Telt het aantal grote-groep-aanvragen dat nog handmatig beoordeeld moet worden:
 * - reservations met requires_manual_approval=true OF large_group_status='awaiting_approval'
 *   (en status niet cancelled / no_show / completed)
 * - large_group_requests met status='new'
 */
export function usePendingLargeGroups() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["pending-large-groups", restaurantId],
    enabled: !!restaurantId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [resvApproval, resvAwaiting, requestsNew] = await Promise.all([
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId!)
          .eq("requires_manual_approval", true)
          .not("status", "in", "(cancelled,no_show,completed)"),
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId!)
          .eq("large_group_status", "awaiting_approval")
          .eq("requires_manual_approval", false)
          .not("status", "in", "(cancelled,no_show,completed)"),
        supabase
          .from("large_group_requests")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId!)
          .eq("status", "new"),
      ]);

      const a = resvApproval.count ?? 0;
      const b = resvAwaiting.count ?? 0;
      const c = requestsNew.count ?? 0;
      return a + b + c;
    },
  });

  // Lichte realtime: invalidate bij wijzigingen op beide tabellen.
  useEffect(() => {
    if (!restaurantId) return;
    const channelName = `pending-large-groups:${restaurantId}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ["pending-large-groups", restaurantId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "large_group_requests", filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ["pending-large-groups", restaurantId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, qc]);

  return { count: query.data ?? 0, isLoading: query.isLoading };
}
