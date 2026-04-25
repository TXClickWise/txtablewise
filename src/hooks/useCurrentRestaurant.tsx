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
    phone: string | null;
    email: string | null;
    address_line1: string | null;
    postal_code: string | null;
    city: string | null;
    slot_duration_minutes: number;
    default_reservation_minutes: number;
    max_party_size_online: number;
    large_group_threshold: number;
    booking_lead_time_minutes: number;
    hold_minutes: number;
    booking_horizon_days: number;
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
        .select("restaurant_id, role, restaurants!inner(*)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MembershipRow[];
    },
  });
};
      if (error) throw error;
      return (data ?? []) as unknown as MembershipRow[];
    },
  });
};
