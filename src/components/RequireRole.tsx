import { ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, ShieldAlert } from "lucide-react";

type Role = "owner" | "manager" | "host" | "staff";

type Props = {
  allow: Role[];
  children: ReactNode;
  redirectTo?: string;
};

/**
 * Guards a route based on the user's role in the current restaurant.
 * Shows an "Access denied" screen with a back / dashboard button instead of
 * silently redirecting, so users never end up stranded.
 */
export const RequireRole = ({ allow, children }: Props) => {
  const { current, loading } = useRestaurant();
  const navigate = useNavigate();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Laden…</div>;
  }
  if (!current) return <Navigate to="/onboarding" replace />;

  if (!allow.includes(current.role as Role)) {
    return (
      <div className="p-6">
        <Card className="max-w-lg mx-auto p-6 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-display text-lg mb-1">Geen toegang</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Je hebt geen rechten voor deze pagina.
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
};
