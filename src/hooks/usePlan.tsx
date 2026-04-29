import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import {
  type SubscriptionPlan,
  type FeatureKey,
  hasFeature as hasFeatureFn,
  trialDaysLeft,
  PLANS,
} from "@/lib/plans";

interface PlanData {
  plan: SubscriptionPlan;
  trialEndsAt: string | null;
  planStartedAt: string | null;
}

export function usePlan() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id ?? null;
  const { data: isSystemAdmin } = useIsSystemAdmin();

  const query = useQuery<PlanData | null>({
    queryKey: ["restaurant-plan", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("plan, trial_ends_at, plan_started_at")
        .eq("id", restaurantId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        plan: (data.plan as SubscriptionPlan) ?? "trial",
        trialEndsAt: data.trial_ends_at as string | null,
        planStartedAt: data.plan_started_at as string | null,
      };
    },
  });

  const plan: SubscriptionPlan = query.data?.plan ?? "trial";
  const trialEndsAt = query.data?.trialEndsAt ?? null;
  const daysLeft = trialDaysLeft(trialEndsAt);
  const isTrial = plan === "trial";
  const trialExpired = isTrial && daysLeft !== null && daysLeft <= 0;

  function hasFeature(key: FeatureKey): boolean {
    // System admins zien alles (handig voor support / debug)
    if (isSystemAdmin) return true;
    return hasFeatureFn(plan, key);
  }

  return {
    plan,
    planDef: PLANS[plan],
    trialEndsAt,
    trialDaysLeft: daysLeft,
    isTrial,
    trialExpired,
    isLoading: query.isLoading,
    hasFeature,
    restaurantId,
  };
}
