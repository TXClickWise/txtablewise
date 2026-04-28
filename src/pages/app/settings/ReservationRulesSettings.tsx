import CapacitySettings from "./CapacitySettings";
import LargeGroupSettings from "./LargeGroupSettings";
import NoShowSettings from "./NoShowSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ReservationRulesSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl mb-1">Reserveringen</h1>
        <p className="text-sm text-muted-foreground">
          Capaciteit, grote groepen en no-show preventieregels.
        </p>
      </div>
      <Tabs defaultValue="capacity">
        <TabsList>
          <TabsTrigger value="capacity">Capaciteit</TabsTrigger>
          <TabsTrigger value="large">Grote groepen</TabsTrigger>
          <TabsTrigger value="noshow">No-show regels</TabsTrigger>
        </TabsList>
        <TabsContent value="capacity" className="mt-4">
          <CapacitySettings />
        </TabsContent>
        <TabsContent value="large" className="mt-4">
          <LargeGroupSettings />
        </TabsContent>
        <TabsContent value="noshow" className="mt-4">
          <NoShowSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
