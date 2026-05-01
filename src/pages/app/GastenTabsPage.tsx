import { TabbedPage } from "@/components/TabbedPage";
import GuestsPage from "./GuestsPage";
import LargeGroupsPage from "./LargeGroupsPage";

export default function GastenTabsPage() {
  return (
    <TabbedPage
      tabs={[
        { value: "alle", label: "Alle gasten", content: <GuestsPage /> },
        { value: "grote-groepen", label: "Grote groepen", content: <LargeGroupsPage /> },
      ]}
    />
  );
}
