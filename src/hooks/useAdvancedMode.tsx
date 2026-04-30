import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "./useRestaurant";
import { useIsSystemAdmin } from "./useIsSystemAdmin";

/**
 * Advanced Mode — verbergt technische opties (webhooks, mappings, raw payloads,
 * workflow IDs, integratie-logs, edge function debug) voor "gewone" eindgebruikers.
 *
 * Twee mechanismen:
 *  - System admins (`is_system_admin()`) zien álles, altijd. Geen toggle nodig.
 *  - Restaurant managers/owners kunnen per restaurant Advanced Mode aanzetten.
 *    Opgeslagen in `restaurants.metadata.advanced_mode` (boolean, default false).
 *
 * `canSeeAdvanced` is de gecombineerde vlag die je in UI moet checken
 * (sidebar items, settings-secties, link "Geavanceerd beheren").
 */
export function useAdvancedMode() {
  const { current } = useRestaurant();
  const { isSystemAdmin } = useIsSystemAdmin();
  const qc = useQueryClient();

  // restaurants.metadata is jsonb — niet getypeerd in useCurrentRestaurant, dus losse cast.
  const restaurant = current?.restaurants as unknown as
    | { id: string; metadata?: { advanced_mode?: boolean } | null }
    | undefined;
  const enabled = !!restaurant?.metadata?.advanced_mode;
  const canSeeAdvanced = isSystemAdmin || enabled;

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (!restaurant?.id) return { ok: false as const, error: "Geen restaurant geselecteerd" };
      const nextMetadata = { ...(restaurant.metadata ?? {}), advanced_mode: next };
      const { error } = await supabase
        .from("restaurants")
        .update({ metadata: nextMetadata })
        .eq("id", restaurant.id);
      if (error) return { ok: false as const, error: error.message };
      // Vernieuw membership-cache zodat current.restaurants.metadata bijwerkt
      await qc.invalidateQueries({ queryKey: ["my-restaurants"] });
      return { ok: true as const };
    },
    [restaurant?.id, restaurant?.metadata, qc]
  );

  const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled]);

  return useMemo(
    () => ({
      /** Toggle-stand opgeslagen op het restaurant (los van admin-status). */
      enabled,
      /** True als de huidige user een platform-wide system admin is. */
      isAdmin: isSystemAdmin,
      /** True als technische UI getoond moet worden (admin OF toggle aan). */
      canSeeAdvanced,
      /** Programmatisch zetten van de restaurant-flag. */
      setEnabled,
      /** Toggle de restaurant-flag aan/uit. */
      toggle,
    }),
    [enabled, isSystemAdmin, canSeeAdvanced, setEnabled, toggle]
  );
}
