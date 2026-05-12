import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RequireRole } from "@/components/RequireRole";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import ReserveWidget from "./pages/ReserveWidget.tsx";
import GuestManageReservation from "./pages/GuestManageReservation.tsx";
import TodayPage from "./pages/app/TodayPage.tsx";
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
import HoursClosuresSettings from "./pages/app/settings/HoursClosuresSettings.tsx";
import ReservationRulesSettings from "./pages/app/settings/ReservationRulesSettings.tsx";
import GuestsSettings from "./pages/app/settings/GuestsSettings.tsx";
import MessagesSettings from "./pages/app/settings/MessagesSettings.tsx";
import AiVoiceSettings from "./pages/app/settings/AiVoiceSettings.tsx";
import ApiWebhooksSettings from "./pages/app/settings/ApiWebhooksSettings.tsx";
import UsersRolesSettings from "./pages/app/settings/UsersRolesSettings.tsx";
import SubscriptionSettings from "./pages/app/settings/SubscriptionSettings.tsx";
import WidgetSettings from "./pages/app/settings/WidgetSettings.tsx";
import WaitlistPage from "./pages/app/WaitlistPage.tsx";
import VoiceAgentHelp from "./pages/app/help/VoiceAgentHelp.tsx";
import IntegrationHubPage from "./pages/app/IntegrationHubPage.tsx";
import IntegrationLogsPage from "./pages/app/IntegrationLogsPage.tsx";
import ClickWiseIntegrationPage from "./pages/app/ClickWiseIntegrationPage.tsx";
import POSIntegrationPage from "./pages/app/POSIntegrationPage.tsx";
import ReportsPage from "./pages/app/ReportsPage.tsx";
import OnboardingWizardPage from "./pages/app/OnboardingWizardPage.tsx";
import PilotReadinessPage from "./pages/app/PilotReadinessPage.tsx";
import PilotLaunchSettings from "./pages/app/settings/PilotLaunchSettings.tsx";
import AdminVoiceAgentPage from "./pages/app/admin/AdminVoiceAgentPage.tsx";
import AdminPlanRequestsPage from "./pages/app/admin/AdminPlanRequestsPage.tsx";
import AdminClickWiseVoiceSetupPage from "./pages/app/admin/AdminClickWiseVoiceSetupPage.tsx";
import AdminRestaurantsPage from "./pages/app/admin/AdminRestaurantsPage.tsx";
import AdminRestaurantDetailPage from "./pages/app/admin/AdminRestaurantDetailPage.tsx";
import { RequireSystemAdmin } from "./components/RequireSystemAdmin";
import AgendaPage from "./pages/app/AgendaPage.tsx";
import VloerTabsPage from "./pages/app/VloerTabsPage.tsx";
import GastenTabsPage from "./pages/app/GastenTabsPage.tsx";
import GastcommunicatiePage from "./pages/app/GastcommunicatiePage.tsx";
import AIHostVoicePage from "./pages/app/AIHostVoicePage.tsx";
import KoppelingenTabsPage from "./pages/app/KoppelingenTabsPage.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

import { useNewBuildNotifier } from "@/hooks/useNewBuildNotifier";

const NewBuildWatcher = () => {
  useNewBuildNotifier();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <NewBuildWatcher />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/r/:slug" element={<ErrorBoundary label="ReserveWidget"><ReserveWidget /></ErrorBoundary>} />
            <Route path="/reserveer/:slug" element={<ErrorBoundary label="ReserveWidget"><ReserveWidget /></ErrorBoundary>} />
            <Route path="/book/:slug" element={<ErrorBoundary label="ReserveWidget"><ReserveWidget /></ErrorBoundary>} />
            <Route path="/r/manage/:token" element={<GuestManageReservation />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<ErrorBoundary label="TodayPage"><TodayPage /></ErrorBoundary>} />
              <Route path="onboarding" element={<RequireRole allow={["owner"]}><OnboardingWizardPage /></RequireRole>} />

              {/* Geconsolideerde schermen */}
              <Route path="agenda" element={<ErrorBoundary label="AgendaPage"><AgendaPage /></ErrorBoundary>} />
              <Route path="vloer" element={<ErrorBoundary label="VloerTabsPage"><VloerTabsPage /></ErrorBoundary>} />
              <Route path="gasten" element={<ErrorBoundary label="GastenTabsPage"><GastenTabsPage /></ErrorBoundary>} />
              <Route path="gastcommunicatie" element={<RequireRole allow={["owner","manager"]}><GastcommunicatiePage /></RequireRole>} />
              <Route path="ai-voice" element={<RequireRole allow={["owner","manager"]}><AIHostVoicePage /></RequireRole>} />
              <Route path="koppelingen" element={<RequireRole allow={["owner","manager"]}><KoppelingenTabsPage /></RequireRole>} />

              {/* Operatie — losse schermen */}
              <Route path="walk-ins" element={<Navigate to="/app" replace />} />
              <Route path="wachtlijst" element={<ErrorBoundary label="WaitlistPage"><WaitlistPage /></ErrorBoundary>} />
              <Route path="rapportages" element={<RequireRole allow={["owner","manager"]}><ReportsPage /></RequireRole>} />
              <Route path="help/voice-agent" element={<VoiceAgentHelp />} />

              {/* Legacy redirects naar nieuwe tab-locaties */}
              <Route path="reserveringen" element={<Navigate to="/app/agenda?tab=lijst" replace />} />
              <Route path="tafelplan" element={<Navigate to="/app/instellingen/zones" replace />} />
              <Route path="floor" element={<Navigate to="/app/vloer" replace />} />
              <Route path="grote-groepen" element={<Navigate to="/app/gasten?tab=grote-groepen" replace />} />
              <Route path="no-show" element={<Navigate to="/app/gastcommunicatie?tab=no-show" replace />} />
              <Route path="drankjes" element={<Navigate to="/app/gastcommunicatie?tab=drankjes" replace />} />
              <Route path="reviews" element={<Navigate to="/app/gastcommunicatie?tab=reviews" replace />} />
              <Route path="ai-host" element={<Navigate to="/app/ai-voice?tab=ai-host" replace />} />
              <Route path="voice-agent" element={<Navigate to="/app/ai-voice?tab=voice" replace />} />
              <Route path="integraties" element={<Navigate to="/app/koppelingen?tab=hub" replace />} />

              {/* Admin-only routes (system admin) */}
              <Route path="admin/restaurants" element={<RequireSystemAdmin><AdminRestaurantsPage /></RequireSystemAdmin>} />
              <Route path="admin/restaurants/:id" element={<RequireSystemAdmin><AdminRestaurantDetailPage /></RequireSystemAdmin>} />
              <Route path="admin/voice-agent" element={<RequireSystemAdmin><AdminVoiceAgentPage /></RequireSystemAdmin>} />
              <Route path="admin/clickwise-voice-setup" element={<RequireSystemAdmin><AdminClickWiseVoiceSetupPage /></RequireSystemAdmin>} />
              <Route path="admin/plan-requests" element={<RequireSystemAdmin><AdminPlanRequestsPage /></RequireSystemAdmin>} />
              <Route path="admin/integraties" element={<RequireSystemAdmin><IntegrationHubPage /></RequireSystemAdmin>} />
              <Route path="admin/logs" element={<RequireSystemAdmin><IntegrationLogsPage /></RequireSystemAdmin>} />
              <Route path="admin/clickwise" element={<RequireSystemAdmin><ClickWiseIntegrationPage /></RequireSystemAdmin>} />
              <Route path="admin/pos" element={<RequireSystemAdmin><POSIntegrationPage /></RequireSystemAdmin>} />
              <Route path="admin/pilot-readiness" element={<RequireSystemAdmin><PilotReadinessPage /></RequireSystemAdmin>} />

              {/* Legacy redirects — kept for old links, also guarded */}
              <Route path="pilot-readiness" element={<RequireSystemAdmin><PilotReadinessPage /></RequireSystemAdmin>} />
              <Route path="integraties/clickwise" element={<RequireRole allow={["owner","manager"]}><ClickWiseIntegrationPage /></RequireRole>} />
              <Route path="integraties/pos" element={<RequireRole allow={["owner","manager"]}><POSIntegrationPage /></RequireRole>} />
              <Route path="integraties/hub" element={<RequireRole allow={["owner","manager"]}><IntegrationHubPage /></RequireRole>} />
              <Route path="integraties/logs" element={<RequireRole allow={["owner","manager"]}><IntegrationLogsPage /></RequireRole>} />
              <Route path="instellingen" element={<RequireRole allow={["owner","manager"]}><SettingsPage /></RequireRole>}>
                <Route index element={<GeneralSettings />} />
                {/* New grouped sections */}
                <Route path="openingstijden" element={<HoursClosuresSettings />} />
                <Route path="reserveringen" element={<ReservationRulesSettings />} />
                <Route path="zones" element={<ZonesTablesSettings />} />
                <Route path="widget" element={<WidgetSettings />} />
                <Route path="gasten" element={<GuestsSettings />} />
                <Route path="berichten" element={<MessagesSettings />} />
                <Route path="ai-voice" element={<AiVoiceSettings />} />
                <Route path="integraties" element={<RequireRole allow={["owner"]}><IntegrationsSettings /></RequireRole>} />
                <Route path="api" element={<RequireRole allow={["owner"]}><ApiWebhooksSettings /></RequireRole>} />
                <Route path="gebruikers" element={<RequireRole allow={["owner"]}><UsersRolesSettings /></RequireRole>} />
                <Route path="abonnement" element={<RequireRole allow={["owner"]}><SubscriptionSettings /></RequireRole>} />
                <Route path="pilot-launch" element={<RequireRole allow={["owner"]}><PilotLaunchSettings /></RequireRole>} />
                {/* Legacy routes — preserved for old links */}
                <Route path="shifts" element={<ShiftsSettings />} />
                <Route path="capaciteit" element={<CapacitySettings />} />
                <Route path="sluitingen" element={<ClosuresSettings />} />
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
