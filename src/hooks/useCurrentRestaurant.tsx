import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type MembershipRow = {
  restaurant_id: string;
  role: "owner" | "manager" | "host" | "staff";
  restaurants: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
};

export const useMyRestaurants = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-restaurants", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_members")
        .select("restaurant_id, role, restaurants!inner(id, name, slug, timezone)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MembershipRow[];
    },
  });
};
