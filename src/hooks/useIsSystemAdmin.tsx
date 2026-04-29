import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Returns whether the current user is a platform-wide system admin.
 * System admins are managed via the `platform_admins` table (assigned via SQL).
 * This is independent from per-restaurant roles (owner/manager/host/staff).
 */
export function useIsSystemAdmin() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["is-system-admin", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_system_admin");
      if (error) return false;
      return Boolean(data);
    },
  });
  return { isSystemAdmin: !!data, loading: isLoading };
}
