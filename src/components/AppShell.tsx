import { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RestaurantProvider, useRestaurant } from "@/hooks/useRestaurant";
import { useMyRestaurants } from "@/hooks/useCurrentRestaurant";
import { Navigate, useLocation } from "react-router-dom";
import { OnboardingBanner } from "./onboarding/OnboardingBanner";
import { ConnectionStatusNotice } from "./touch";
import { TrialBanner } from "./plan/TrialBanner";
import { PilotWarningBanner } from "./pilot/PilotWarningBanner";

const AppShellInner = ({ children }: { children?: ReactNode }) => {
  const { current, loading } = useRestaurant();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Laden…</div>;
  }
  const isAdminRoute = location.pathname.startsWith("/app/admin");
  if (!current && !isAdminRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  const isWizard = location.pathname.startsWith("/app/onboarding");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex-1" />
          </header>
          <ConnectionStatusNotice />
          <TrialBanner />
          {!isWizard && <PilotWarningBanner />}
          {!isWizard && <OnboardingBanner />}
          <main className="flex-1 overflow-auto">
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export const AppShell = ({ children }: { children?: ReactNode }) => {
  const { isLoading } = useMyRestaurants();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Laden…</div>;
  return (
    <RestaurantProvider>
      <AppShellInner>{children}</AppShellInner>
    </RestaurantProvider>
  );
};
