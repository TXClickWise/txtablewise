import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMyRestaurants } from "@/hooks/useCurrentRestaurant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AppHome = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: memberships, isLoading } = useMyRestaurants();

  useEffect(() => {
    if (!isLoading && memberships && memberships.length === 0) {
      navigate("/onboarding", { replace: true });
    }
  }, [isLoading, memberships, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Laden…</div>
      </div>
    );
  }

  const restaurant = memberships?.[0]?.restaurants;
  const role = memberships?.[0]?.role;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-primary">TableWise</h1>
            {restaurant && (
              <p className="text-sm text-muted-foreground">
                {restaurant.name} · <span className="capitalize">{role}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>Uitloggen</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h2 className="font-display text-3xl mb-2">Vandaag</h2>
          <p className="text-muted-foreground">
            Het dashboard met tafelplan, reserveringen en KPI's komt hier in de volgende stap.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Fase 1 voortgang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><span className="text-primary">✓</span> Design system</div>
            <div className="flex items-center gap-2"><span className="text-primary">✓</span> Database & RLS</div>
            <div className="flex items-center gap-2"><span className="text-primary">✓</span> Authenticatie & onboarding</div>
            <div className="flex items-center gap-2 text-muted-foreground"><span>○</span> Reservation engine (volgende stap)</div>
            <div className="flex items-center gap-2 text-muted-foreground"><span>○</span> Publieke reserveringswidget</div>
            <div className="flex items-center gap-2 text-muted-foreground"><span>○</span> Tablet dashboard + tafelplan</div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AppHome;
