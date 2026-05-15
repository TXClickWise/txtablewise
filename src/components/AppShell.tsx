import { ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RestaurantProvider, useRestaurant } from "@/hooks/useRestaurant";
import { useMyRestaurants } from "@/hooks/useCurrentRestaurant";
import { Navigate } from "react-router-dom";
import { OnboardingBanner } from "./onboarding/OnboardingBanner";
import { ConnectionStatusNotice, OperationTabBar, FloatingActions } from "./touch";
import { isOperationalRoute } from "./touch/OperationTabBar";
import { TrialBanner } from "./plan/TrialBanner";
import { PilotWarningBanner } from "./pilot/PilotWarningBanner";
import { AdminOverrideBanner } from "./admin/AdminOverrideBanner";
import { InstallPrompt } from "./pwa/InstallPrompt";
import { ThemeToggle } from "./ThemeToggle";
import { useIsCompact } from "@/hooks/use-breakpoint";
import { cn } from "@/lib/utils";

const AppShellInner = ({ children }: { children?: ReactNode }) => {
  const { current, loading } = useRestaurant();
  const location = useLocation();
  const isCompact = useIsCompact();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Laden…</div>;
  }
  const isAdminRoute = location.pathname.startsWith("/app/admin");
  if (!current && !isAdminRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  const isWizard = location.pathname.startsWith("/app/onboarding");
  const isAdminSection = location.pathname.startsWith("/app/admin");
  const showTabBar = !isWizard && !isAdminSection;
  const showFab = isOperationalRoute(location.pathname);

  return (
    <SidebarProvider>
      <div className="h-screen overflow-hidden flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <header className="h-12 border-b border-border/60 glass-header flex items-center px-3 gap-2 sticky top-0 z-20">
            <SidebarTrigger />
            {showTabBar ? (
              <OperationTabBar />
            ) : (
              <div className="flex-1 text-sm font-medium text-muted-foreground truncate">
                {current?.restaurants?.name ?? ""}
              </div>
            )}
            {showTabBar && current?.restaurants?.name && (
              <div className="ml-auto text-xs font-medium text-muted-foreground truncate max-w-[180px] sm:max-w-[260px] lg:max-w-[360px]">
                {current.restaurants.name}
              </div>
            )}
            <div className={cn(showTabBar && current?.restaurants?.name ? "ml-2" : "ml-auto")}>
              <ThemeToggle />
            </div>
          </header>
          <AdminOverrideBanner />
          <ConnectionStatusNotice />
          <TrialBanner />
          {!isWizard && <PilotWarningBanner />}
          {!isWizard && <OnboardingBanner />}
          <main className={cn("flex-1 min-h-0", location.pathname === "/app/agenda" ? "overflow-hidden" : "overflow-auto")}>
            {children ?? <Outlet />}
          </main>
        </div>
        {showFab && <FloatingActions />}
        {isCompact && <InstallPrompt />}
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
