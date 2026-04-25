import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import ReserveWidget from "./pages/ReserveWidget.tsx";
import GuestManageReservation from "./pages/GuestManageReservation.tsx";
import TodayPage from "./pages/app/TodayPage.tsx";
import ReservationsPage from "./pages/app/ReservationsPage.tsx";
import FloorPlanPage from "./pages/app/FloorPlanPage.tsx";
import GuestsPage from "./pages/app/GuestsPage.tsx";
import AgendaPage from "./pages/app/AgendaPage.tsx";
import SettingsPage from "./pages/app/SettingsPage.tsx";
import GeneralSettings from "./pages/app/settings/GeneralSettings.tsx";
import OpeningHoursSettings from "./pages/app/settings/OpeningHoursSettings.tsx";
import ShiftsSettings from "./pages/app/settings/ShiftsSettings.tsx";
import ZonesTablesSettings from "./pages/app/settings/ZonesTablesSettings.tsx";
import ClosuresSettings from "./pages/app/settings/ClosuresSettings.tsx";
import IntegrationsSettings from "./pages/app/settings/IntegrationsSettings.tsx";
import CapacitySettings from "./pages/app/settings/CapacitySettings.tsx";
import NoShowSettings from "./pages/app/settings/NoShowSettings.tsx";
import LargeGroupSettings from "./pages/app/settings/LargeGroupSettings.tsx";
import FloorModePage from "./pages/app/FloorModePage.tsx";
import WalkInsPage from "./pages/app/WalkInsPage.tsx";
import WaitlistPage from "./pages/app/WaitlistPage.tsx";
import LargeGroupsPage from "./pages/app/LargeGroupsPage.tsx";
import NoShowPreventionPage from "./pages/app/NoShowPreventionPage.tsx";
import PreOrderDrinksPage from "./pages/app/PreOrderDrinksPage.tsx";
import ReviewsAftercarePage from "./pages/app/ReviewsAftercarePage.tsx";
import AIHostPage from "./pages/app/AIHostPage.tsx";
import IntegrationsPage from "./pages/app/IntegrationsPage.tsx";
import ClickWiseIntegrationPage from "./pages/app/ClickWiseIntegrationPage.tsx";
import ReportsPage from "./pages/app/ReportsPage.tsx";
import OnboardingWizardPage from "./pages/app/OnboardingWizardPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/r/:slug" element={<ReserveWidget />} />
            <Route path="/reserveer/:slug" element={<ReserveWidget />} />
            <Route path="/book/:slug" element={<ReserveWidget />} />
            <Route path="/r/manage/:token" element={<GuestManageReservation />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<TodayPage />} />
              <Route path="onboarding" element={<OnboardingWizardPage />} />
              <Route path="reserveringen" element={<ReservationsPage />} />
              <Route path="tafelplan" element={<FloorPlanPage />} />
              <Route path="floor" element={<FloorModePage />} />
              <Route path="walk-ins" element={<WalkInsPage />} />
              <Route path="wachtlijst" element={<WaitlistPage />} />
              <Route path="gasten" element={<GuestsPage />} />
              <Route path="grote-groepen" element={<LargeGroupsPage />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="no-show" element={<NoShowPreventionPage />} />
              <Route path="drankjes" element={<PreOrderDrinksPage />} />
              <Route path="reviews" element={<ReviewsAftercarePage />} />
              <Route path="ai-host" element={<AIHostPage />} />
              <Route path="rapportages" element={<ReportsPage />} />
              <Route path="integraties" element={<IntegrationsPage />} />
              <Route path="integraties/clickwise" element={<ClickWiseIntegrationPage />} />
              <Route path="instellingen" element={<SettingsPage />}>
                <Route index element={<GeneralSettings />} />
                <Route path="openingstijden" element={<OpeningHoursSettings />} />
                <Route path="shifts" element={<ShiftsSettings />} />
                <Route path="capaciteit" element={<CapacitySettings />} />
                <Route path="zones" element={<ZonesTablesSettings />} />
                <Route path="sluitingen" element={<ClosuresSettings />} />
                <Route path="integraties" element={<IntegrationsSettings />} />
                <Route path="grote-groepen" element={<LargeGroupSettings />} />
                <Route path="no-show" element={<NoShowSettings />} />
              </Route>
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
