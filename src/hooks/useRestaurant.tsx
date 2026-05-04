import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRestaurants, MembershipRow } from "./useCurrentRestaurant";
import { useIsSystemAdmin } from "./useIsSystemAdmin";

type Ctx = {
  current: MembershipRow | null;
  restaurants: MembershipRow[];
  setCurrentId: (id: string) => void;
  loading: boolean;
  // Admin override
  adminOverrideId: string | null;
  setAdminOverride: (id: string | null) => void;
  isAdminOverride: boolean;
};

const RestaurantContext = createContext<Ctx | undefined>(undefined);
const OVERRIDE_KEY = "tw.admin_override_restaurant";

export const RestaurantProvider = ({ children }: { children: ReactNode }) => {
  const { data, isLoading } = useMyRestaurants();
  const { isSystemAdmin } = useIsSystemAdmin();
  const [currentId, setCurrentIdState] = useState<string | null>(
    () => localStorage.getItem("tw.current_restaurant")
  );
  const [adminOverrideId, setAdminOverrideIdState] = useState<string | null>(
    () => localStorage.getItem(OVERRIDE_KEY)
  );

  // When admin override is set and user is system admin, fetch that restaurant directly
  const overrideActive = !!adminOverrideId && isSystemAdmin;
  const { data: overrideRestaurant, isLoading: overrideLoading } = useQuery({
    queryKey: ["admin-override-restaurant", adminOverrideId],
    enabled: overrideActive,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", adminOverrideId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (overrideActive) return; // don't auto-pick when overriding
    if (!isLoading && data && data.length > 0) {
      const stillExists = currentId && data.some((m) => m.restaurant_id === currentId);
      if (!stillExists) {
        const first = data[0].restaurant_id;
        setCurrentIdState(first);
        localStorage.setItem("tw.current_restaurant", first);
      }
    }
  }, [isLoading, data, currentId, overrideActive]);

  const setCurrentId = (id: string) => {
    setCurrentIdState(id);
    localStorage.setItem("tw.current_restaurant", id);
  };

  const setAdminOverride = (id: string | null) => {
    setAdminOverrideIdState(id);
    if (id) localStorage.setItem(OVERRIDE_KEY, id);
    else localStorage.removeItem(OVERRIDE_KEY);
  };

  let current: MembershipRow | null = null;
  if (overrideActive && overrideRestaurant) {
    current = {
      restaurant_id: overrideRestaurant.id,
      role: "owner",
      restaurants: overrideRestaurant as any,
    };
  } else {
    current = data?.find((m) => m.restaurant_id === currentId) ?? data?.[0] ?? null;
  }

  return (
    <RestaurantContext.Provider value={{
      current,
      restaurants: data ?? [],
      setCurrentId,
      loading: isLoading || (overrideActive && overrideLoading),
      adminOverrideId,
      setAdminOverride,
      isAdminOverride: overrideActive && !!overrideRestaurant,
    }}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error("useRestaurant must be inside RestaurantProvider");
  return ctx;
};
