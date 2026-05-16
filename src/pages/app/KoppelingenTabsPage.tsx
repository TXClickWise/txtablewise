import { TabbedPage } from "@/components/TabbedPage";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { useAdvancedMode } from "@/hooks/useAdvancedMode";
import KoppelingenPage from "./KoppelingenPage";
import ClickWiseIntegrationPage from "./ClickWiseIntegrationPage";
import POSIntegrationPage from "./POSIntegrationPage";
import IntegrationHubPage from "./IntegrationHubPage";
import VoiceAgentPage from "./VoiceAgentPage";

export default function KoppelingenTabsPage() {
  const { isSystemAdmin } = useIsSystemAdmin();
  const { canSeeAdvanced } = useAdvancedMode();

  // Standaard zien horeca-ondernemers alleen het overzicht.
  // Detail-tabs (ClickWise-configuratie, POS-mappings, Voice setup, Hub) zijn alleen voor
  // gevorderde gebruikers (Advanced Mode) of system admins.
  const tabs: { value: string; label: string; content: JSX.Element }[] = [
    { value: "overzicht", label: "Overzicht", content: <KoppelingenPage /> },
  ];

  if (canSeeAdvanced || isSystemAdmin) {
    tabs.push(
      { value: "clickwise", label: "ClickWise (geavanceerd)", content: <ClickWiseIntegrationPage /> },
      { value: "pos", label: "POS (geavanceerd)", content: <POSIntegrationPage /> },
      { value: "voice", label: "Voice setup (geavanceerd)", content: <VoiceAgentPage /> },
    );
  }

  if (isSystemAdmin) {
    tabs.push({ value: "hub", label: "Integratiehub (admin)", content: <IntegrationHubPage /> });
  }

  // Geen tabs-balk tonen als er maar één tab is — voelt rustiger.
  if (tabs.length === 1) {
    return <KoppelingenPage />;
  }

  return <TabbedPage tabs={tabs} />;
}
