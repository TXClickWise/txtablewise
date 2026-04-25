import { useRestaurant } from "@/hooks/useRestaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsPage = () => {
  const { current } = useRestaurant();
  const r = current?.restaurants;
  const url = r ? `${window.location.origin}/r/${r.slug}` : "";
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl">Instellingen</h1>
        <p className="text-muted-foreground">Restaurant configuratie</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Restaurant</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Naam</span><span className="font-medium">{r?.name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tijdzone</span><span className="font-medium">{r?.timezone}</span></div>
          <div className="flex justify-between items-center gap-3">
            <span className="text-muted-foreground">Publieke reserveringspagina</span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate font-medium">{url}</a>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Volgende stap</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Beheer voor openingstijden, shifts, tafels en zones komt in de volgende stap (b).
        </CardContent>
      </Card>
    </div>
  );
};
export default SettingsPage;
