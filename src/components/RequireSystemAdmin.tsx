import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export function RequireSystemAdmin({ children }: { children: ReactNode }) {
  const { isSystemAdmin, loading } = useIsSystemAdmin();
  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Laden…</div>;
  }
  if (!isSystemAdmin) {
    return (
      <div className="p-6">
        <Card className="max-w-lg mx-auto p-6 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-lg mb-1">Geen toegang</h2>
            <p className="text-sm text-muted-foreground">
              Deze pagina is alleen beschikbaar voor platformbeheerders.
            </p>
          </div>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}

export function HideForNonAdmin({ children }: { children: ReactNode }) {
  const { isSystemAdmin } = useIsSystemAdmin();
  if (!isSystemAdmin) return null;
  return <>{children}</>;
}
