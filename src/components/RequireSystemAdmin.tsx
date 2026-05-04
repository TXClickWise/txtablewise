import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, ShieldAlert } from "lucide-react";

export function RequireSystemAdmin({ children }: { children: ReactNode }) {
  const { isSystemAdmin, loading } = useIsSystemAdmin();
  const navigate = useNavigate();
  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Laden…</div>;
  }
  if (!isSystemAdmin) {
    return (
      <div className="p-6">
        <Card className="max-w-lg mx-auto p-6 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-display text-lg mb-1">Geen toegang</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Deze pagina is alleen beschikbaar voor platformbeheerders.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Terug
              </Button>
              <Button size="sm" onClick={() => navigate("/app")}>
                <Home className="h-4 w-4 mr-1.5" /> Naar dashboard
              </Button>
            </div>
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
