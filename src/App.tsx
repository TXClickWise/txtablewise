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
import TodayPage from "./pages/app/TodayPage.tsx";
import ReservationsPage from "./pages/app/ReservationsPage.tsx";
import FloorPlanPage from "./pages/app/FloorPlanPage.tsx";
import GuestsPage from "./pages/app/GuestsPage.tsx";
import AgendaPage from "./pages/app/AgendaPage.tsx";
import SettingsPage from "./pages/app/SettingsPage.tsx";
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
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<TodayPage />} />
              <Route path="reserveringen" element={<ReservationsPage />} />
              <Route path="tafelplan" element={<FloorPlanPage />} />
              <Route path="gasten" element={<GuestsPage />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="instellingen" element={<SettingsPage />} />
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
