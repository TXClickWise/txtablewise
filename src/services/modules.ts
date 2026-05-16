// Generieke aan/uit-vlaggen per restaurant via restaurant_modules.
// Afwezigheid van een rij = module staat AAN (veilige default voor bestaande klanten).
import { supabase } from "@/integrations/supabase/client";

export type ModuleKey = "pre_orders";

export async function getModuleEnabled(
  restaurantId: string,
  key: ModuleKey,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("restaurant_modules")
    .select("is_enabled")
    .eq("restaurant_id", restaurantId)
    .eq("module_key", key)
    .maybeSingle();
  if (error) return true;
  if (!data) return true;
  return data.is_enabled !== false;
}

export async function setModuleEnabled(
  restaurantId: string,
  key: ModuleKey,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("restaurant_modules")
    .upsert(
      { restaurant_id: restaurantId, module_key: key, is_enabled: enabled },
      { onConflict: "restaurant_id,module_key" },
    );
  if (error) throw new Error(error.message);
}
