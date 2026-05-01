import { TabbedPage } from "@/components/TabbedPage";
import NoShowPreventionPage from "./NoShowPreventionPage";
import ReviewsAftercarePage from "./ReviewsAftercarePage";
import PreOrderDrinksPage from "./PreOrderDrinksPage";

export default function GastcommunicatiePage() {
  return (
    <TabbedPage
      tabs={[
        { value: "no-show", label: "No-show preventie", content: <NoShowPreventionPage /> },
        { value: "reviews", label: "Reviews & aftercare", content: <ReviewsAftercarePage /> },
        { value: "drankjes", label: "Drankjes vooraf", content: <PreOrderDrinksPage /> },
      ]}
    />
  );
}
