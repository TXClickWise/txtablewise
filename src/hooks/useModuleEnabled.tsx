import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getModuleEnabled, setModuleEnabled, type ModuleKey } from "@/services/modules";

export function useModuleEnabled(restaurantId: string | undefined, key: ModuleKey) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["module-enabled", restaurantId, key],
    enabled: !!restaurantId,
    queryFn: () => getModuleEnabled(restaurantId!, key),
    staleTime: 60_000,
  });
  return {
    enabled: query.data ?? true,
    isLoading: query.isLoading,
    setEnabled: async (v: boolean) => {
      if (!restaurantId) return;
      await setModuleEnabled(restaurantId, key, v);
      qc.setQueryData(["module-enabled", restaurantId, key], v);
    },
  };
}
