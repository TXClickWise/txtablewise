import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useMyRestaurants, MembershipRow } from "./useCurrentRestaurant";

type Ctx = {
  current: MembershipRow | null;
  restaurants: MembershipRow[];
  setCurrentId: (id: string) => void;
  loading: boolean;
};

const RestaurantContext = createContext<Ctx | undefined>(undefined);

export const RestaurantProvider = ({ children }: { children: ReactNode }) => {
  const { data, isLoading } = useMyRestaurants();
  const [currentId, setCurrentIdState] = useState<string | null>(
    () => localStorage.getItem("tw.current_restaurant")
  );

  useEffect(() => {
    if (!isLoading && data && data.length > 0) {
      const stillExists = currentId && data.some((m) => m.restaurant_id === currentId);
      if (!stillExists) {
        const first = data[0].restaurant_id;
        setCurrentIdState(first);
        localStorage.setItem("tw.current_restaurant", first);
      }
    }
  }, [isLoading, data, currentId]);

  const setCurrentId = (id: string) => {
    setCurrentIdState(id);
    localStorage.setItem("tw.current_restaurant", id);
  };

  const current = data?.find((m) => m.restaurant_id === currentId) ?? data?.[0] ?? null;

  return (
    <RestaurantContext.Provider value={{
      current, restaurants: data ?? [], setCurrentId, loading: isLoading,
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
