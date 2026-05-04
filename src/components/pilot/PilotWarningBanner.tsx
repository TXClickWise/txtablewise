import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { usePilotReadiness } from "@/hooks/usePilotReadiness";

/**
 * Dashboard banner that appears when required pilot readiness items are
 * still missing. Operators with role host/staff don't see it (they can't fix it).
 */
export const PilotWarningBanner = () => {
  const { current } = useRestaurant();
  const { data } = usePilotReadiness(current?.restaurant_id);
  const [dismissed, setDismissed] = useState(false);

  if (!current || !data || data.allRequiredOk || dismissed) return null;
  if (current.role !== "owner" && current.role !== "manager") return null;

  const missing = data.requiredTotal - data.requiredOk;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-sm flex items-center gap-3">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-amber-900 dark:text-amber-100">
          {missing} verplichte instelling{missing === 1 ? "" : "en"} ontbreken nog voor pilot-lancering.
        </span>{" "}
        <Link to="/app/instellingen/pilot-launch" className="underline font-medium">
          Bekijk checklist
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-700 dark:text-amber-300 hover:text-amber-900"
        aria-label="Sluiten"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
