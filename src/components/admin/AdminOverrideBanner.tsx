import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";

export const AdminOverrideBanner = () => {
  const { isAdminOverride, current, setAdminOverride } = useRestaurant();
  const { isSystemAdmin } = useIsSystemAdmin();
  const navigate = useNavigate();

  if (!isSystemAdmin || !isAdminOverride || !current) return null;

  const handleExit = () => {
    setAdminOverride(null);
    navigate("/app/admin/restaurants");
  };

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/40 text-amber-900 dark:text-amber-200 px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="text-sm truncate">
          Je bekijkt <strong>{current.restaurants.name}</strong> als platformbeheerder. Wijzigingen worden bij dit restaurant doorgevoerd.
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={handleExit} className="shrink-0 bg-background">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Terug naar admin
      </Button>
    </div>
  );
};
