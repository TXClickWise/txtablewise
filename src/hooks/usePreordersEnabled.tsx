import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Master aan/uit voor de "Drankjes vooraf"-module per restaurant.
 * Leest/schrijft `restaurants.preorders_enabled` (default true voor bestaande restaurants).
 * Gating-punten:
 *  - Publieke widget (al ingebouwd via restaurant.preorders_enabled in ReserveWidget).
 *  - Beheerpagina dimt en toont uitleg als uit.
 *  - Reservering-detail sectie verbergt UI als uit en er geen bestaande items zijn.
 */
export function usePreordersEnabled(restaurantId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["preorders-enabled", restaurantId],
    enabled: !!restaurantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("preorders_enabled")
        .eq("id", restaurantId!)
        .maybeSingle();
      if (error) return true;
      return data?.preorders_enabled !== false;
    },
  });

  return {
    enabled: query.data ?? true,
    isLoading: query.isLoading,
    setEnabled: async (next: boolean) => {
      if (!restaurantId) return;
      const { error } = await supabase
        .from("restaurants")
        .update({ preorders_enabled: next })
        .eq("id", restaurantId);
      if (error) throw new Error(error.message);
      qc.setQueryData(["preorders-enabled", restaurantId], next);
    },
  };
}
