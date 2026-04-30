import type { ReactNode } from "react";
import { useAdvancedMode } from "@/hooks/useAdvancedMode";

type Props = {
  children: ReactNode;
  /** Optioneel: wat te tonen wanneer Advanced Mode uit staat. Default: niets. */
  fallback?: ReactNode;
};

/**
 * Toont children alleen als de huidige user technische opties mag zien.
 * Dat is het geval als:
 *  - de user een platform system admin is, OF
 *  - de Advanced Mode toggle van het huidige restaurant aan staat.
 *
 * Gebruik dit voor sidebar-items, settings-secties, "Geavanceerd beheren"-links,
 * raw-payload-views en andere developer-georiënteerde UI.
 */
export function AdvancedOnly({ children, fallback = null }: Props) {
  const { canSeeAdvanced } = useAdvancedMode();
  if (!canSeeAdvanced) return <>{fallback}</>;
  return <>{children}</>;
}
