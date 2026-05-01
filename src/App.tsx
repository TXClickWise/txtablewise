import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import WalkInsPage from "./pages/app/WalkInsPage.tsx";
import WaitlistPage from "./pages/app/WaitlistPage.tsx";
import VoiceAgentHelp from "./pages/app/help/VoiceAgentHelp.tsx";
import IntegrationHubPage from "./pages/app/IntegrationHubPage.tsx";
import IntegrationLogsPage from "./pages/app/IntegrationLogsPage.tsx";
import ClickWiseIntegrationPage from "./pages/app/ClickWiseIntegrationPage.tsx";
import POSIntegrationPage from "./pages/app/POSIntegrationPage.tsx";
import ReportsPage from "./pages/app/ReportsPage.tsx";
import OnboardingWizardPage from "./pages/app/OnboardingWizardPage.tsx";
import PilotReadinessPage from "./pages/app/PilotReadinessPage.tsx";
import AdminVoiceAgentPage from "./pages/app/admin/AdminVoiceAgentPage.tsx";
import AdminPlanRequestsPage from "./pages/app/admin/AdminPlanRequestsPage.tsx";
import AdminClickWiseVoiceSetupPage from "./pages/app/admin/AdminClickWiseVoiceSetupPage.tsx";
import { RequireSystemAdmin } from "./components/RequireSystemAdmin";
import AgendaTabsPage from "./pages/app/AgendaTabsPage.tsx";
import VloerTabsPage from "./pages/app/VloerTabsPage.tsx";
import GastenTabsPage from "./pages/app/GastenTabsPage.tsx";
import GastcommunicatiePage from "./pages/app/GastcommunicatiePage.tsx";
import AIHostVoicePage from "./pages/app/AIHostVoicePage.tsx";
import KoppelingenTabsPage from "./pages/app/KoppelingenTabsPage.tsx";
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

              {/* Geconsolideerde schermen */}
              <Route path="agenda" element={<AgendaTabsPage />} />
              <Route path="vloer" element={<VloerTabsPage />} />
              <Route path="gasten" element={<GastenTabsPage />} />
              <Route path="gastcommunicatie" element={<GastcommunicatiePage />} />
              <Route path="ai-voice" element={<AIHostVoicePage />} />
              <Route path="koppelingen" element={<KoppelingenTabsPage />} />

              {/* Operatie — losse schermen */}
              <Route path="walk-ins" element={<WalkInsPage />} />
              <Route path="wachtlijst" element={<WaitlistPage />} />
              <Route path="rapportages" element={<ReportsPage />} />
              <Route path="help/voice-agent" element={<VoiceAgentHelp />} />

              {/* Legacy redirects naar nieuwe tab-locaties */}
              <Route path="reserveringen" element={<Navigate to="/app/agenda?tab=lijst" replace />} />
              <Route path="tafelplan" element={<Navigate to="/app/vloer?tab=bewerken" replace />} />
              <Route path="floor" element={<Navigate to="/app/vloer?tab=live" replace />} />
              <Route path="grote-groepen" element={<Navigate to="/app/gasten?tab=grote-groepen" replace />} />
              <Route path="no-show" element={<Navigate to="/app/gastcommunicatie?tab=no-show" replace />} />
              <Route path="drankjes" element={<Navigate to="/app/gastcommunicatie?tab=drankjes" replace />} />
              <Route path="reviews" element={<Navigate to="/app/gastcommunicatie?tab=reviews" replace />} />
              <Route path="ai-host" element={<Navigate to="/app/ai-voice?tab=ai-host" replace />} />
              <Route path="voice-agent" element={<Navigate to="/app/ai-voice?tab=voice" replace />} />
              <Route path="integraties" element={<Navigate to="/app/koppelingen?tab=hub" replace />} />

              {/* Admin-only routes (system admin) */}
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
              <Route path="integraties/clickwise" element={<RequireSystemAdmin><ClickWiseIntegrationPage /></RequireSystemAdmin>} />
              <Route path="integraties/pos" element={<RequireSystemAdmin><POSIntegrationPage /></RequireSystemAdmin>} />
              <Route path="integraties/hub" element={<RequireSystemAdmin><IntegrationHubPage /></RequireSystemAdmin>} />
              <Route path="integraties/logs" element={<RequireSystemAdmin><IntegrationLogsPage /></RequireSystemAdmin>} />
              <Route path="instellingen" element={<SettingsPage />}>
                <Route index element={<GeneralSettings />} />
                {/* New grouped sections */}
                <Route path="openingstijden" element={<HoursClosuresSettings />} />
                <Route path="reserveringen" element={<ReservationRulesSettings />} />
                <Route path="zones" element={<ZonesTablesSettings />} />
                <Route path="widget" element={<WidgetSettings />} />
                <Route path="gasten" element={<GuestsSettings />} />
                <Route path="berichten" element={<MessagesSettings />} />
                <Route path="ai-voice" element={<AiVoiceSettings />} />
                <Route path="integraties" element={<IntegrationsSettings />} />
                <Route path="api" element={<ApiWebhooksSettings />} />
                <Route path="gebruikers" element={<UsersRolesSettings />} />
                <Route path="abonnement" element={<SubscriptionSettings />} />
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
