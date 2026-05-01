import { TabbedPage } from "@/components/TabbedPage";
import AgendaPage from "./AgendaPage";
import ReservationsPage from "./ReservationsPage";

export default function AgendaTabsPage() {
  return (
    <TabbedPage
      tabs={[
        { value: "tijdlijn", label: "Tijdlijn", content: <AgendaPage /> },
        { value: "lijst", label: "Lijst", content: <ReservationsPage /> },
      ]}
    />
  );
}
