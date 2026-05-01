import { TabbedPage } from "@/components/TabbedPage";
import FloorModePage from "./FloorModePage";
import FloorPlanPage from "./FloorPlanPage";

export default function VloerTabsPage() {
  return (
    <TabbedPage
      tabs={[
        { value: "live", label: "Live", content: <FloorModePage /> },
        { value: "bewerken", label: "Bewerken", content: <FloorPlanPage /> },
      ]}
    />
  );
}
