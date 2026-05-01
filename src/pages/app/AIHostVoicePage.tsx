import { TabbedPage } from "@/components/TabbedPage";
import AIHostPage from "./AIHostPage";
import VoiceAgentPage from "./VoiceAgentPage";

export default function AIHostVoicePage() {
  return (
    <TabbedPage
      tabs={[
        { value: "ai-host", label: "AI Host", content: <AIHostPage /> },
        { value: "voice", label: "Voice Agent", content: <VoiceAgentPage /> },
      ]}
    />
  );
}
