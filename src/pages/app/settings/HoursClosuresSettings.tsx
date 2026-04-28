import OpeningHoursSettings from "./OpeningHoursSettings";
import ShiftsSettings from "./ShiftsSettings";
import ClosuresSettings from "./ClosuresSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function HoursClosuresSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl mb-1">Openingstijden</h1>
        <p className="text-sm text-muted-foreground">
          Reguliere tijden, shifts voor lunch/diner en uitzonderingen op de kalender.
        </p>
      </div>
      <Tabs defaultValue="hours">
        <TabsList>
          <TabsTrigger value="hours">Reguliere tijden</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="closures">Sluitingen</TabsTrigger>
        </TabsList>
        <TabsContent value="hours" className="mt-4">
          <OpeningHoursSettings />
        </TabsContent>
        <TabsContent value="shifts" className="mt-4">
          <ShiftsSettings />
        </TabsContent>
        <TabsContent value="closures" className="mt-4">
          <ClosuresSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
