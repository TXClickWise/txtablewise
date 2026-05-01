import { TabbedPage } from "@/components/TabbedPage";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import KoppelingenPage from "./KoppelingenPage";
import ClickWiseIntegrationPage from "./ClickWiseIntegrationPage";
import POSIntegrationPage from "./POSIntegrationPage";
import IntegrationHubPage from "./IntegrationHubPage";
import VoiceAgentPage from "./VoiceAgentPage";

export default function KoppelingenTabsPage() {
  const { isSystemAdmin } = useIsSystemAdmin();

  const tabs = [
    { value: "overzicht", label: "Overzicht", content: <KoppelingenPage /> },
    { value: "clickwise", label: "ClickWise", content: <ClickWiseIntegrationPage /> },
    { value: "pos", label: "POS", content: <POSIntegrationPage /> },
    { value: "voice", label: "Voice setup", content: <VoiceAgentPage /> },
  ];

  if (isSystemAdmin) {
    tabs.push({ value: "hub", label: "Integratiehub", content: <IntegrationHubPage /> });
  }

  return <TabbedPage tabs={tabs} />;
}
