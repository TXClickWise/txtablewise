import { useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CloudSun, MapPin } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function WeatherSettingsCard() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();

  const { data: cfg, refetch } = useQuery({
    queryKey: ["weather-config", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("weather_enabled, weather_location_override, weather_location_label, latitude, longitude, address_line1, city, postal_code")
        .eq("id", restaurantId!)
        .maybeSingle();
      return data;
    },
  });

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  if (!cfg) return null;

  const hasLocation = cfg.latitude !== null && cfg.longitude !== null;
  const hasAddress = !!(cfg.address_line1 || cfg.city || cfg.postal_code);

  const toggleEnabled = async (next: boolean) => {
    setBusy(true);
    await supabase.from("restaurants").update({ weather_enabled: next }).eq("id", restaurantId!);
    setBusy(false);
    refetch();
    if (next && !hasLocation && hasAddress) {
      runGeocode();
    }
  };

  const runGeocode = async (manual?: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("weather_geocode", {
      body: { restaurant_id: restaurantId, query: manual },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error("Locatie ophalen mislukt — controleer je adres of voer plaatsnaam handmatig in.");
      return;
    }
    toast.success("Locatie opgeslagen");
    setOverrideOpen(false);
    setQuery("");
    refetch();
    // Trigger immediate fetch
    await supabase.functions.invoke("weather_fetcher", { body: { restaurant_id: restaurantId } });
    qc.invalidateQueries({ queryKey: ["weather-hourly"] });
    qc.invalidateQueries({ queryKey: ["weather-daily"] });
    qc.invalidateQueries({ queryKey: ["weather-advisories"] });
  };

  const resetToAuto = async () => {
    setBusy(true);
    await supabase.from("restaurants").update({
      weather_location_override: false,
      weather_location_label: null,
    }).eq("id", restaurantId!);
    await runGeocode();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <CloudSun className="h-4 w-4" /> Weer-inzichten
        </CardTitle>
        <CardDescription>
          Toon het weer voor vandaag, de komende uren en de week. Wij waarschuwen alleen
          als het weer iets verandert aan je dienst — geen meteorologie-cursus nodig.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Weer-inzichten gebruiken</Label>
            <p className="text-xs text-muted-foreground">
              Pill op /Vandaag en /Vloer + stille tips bij regen, hitte, vorst of mooi weekend.
            </p>
          </div>
          <Switch checked={!!cfg.weather_enabled} disabled={busy} onCheckedChange={toggleEnabled} />
        </div>

        {cfg.weather_enabled && (
          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>
                  Locatie:{" "}
                  {hasLocation ? (
                    <span className="font-medium">
                      {cfg.weather_location_label ?? `${Number(cfg.latitude).toFixed(2)}, ${Number(cfg.longitude).toFixed(2)}`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Nog niet bepaald</span>
                  )}
                </span>
              </div>
              <div className="flex gap-2">
                {cfg.weather_location_override && (
                  <Button size="sm" variant="ghost" onClick={resetToAuto} disabled={busy}>
                    Terug naar automatisch
                  </Button>
                )}
                {!hasLocation && hasAddress && (
                  <Button size="sm" variant="outline" onClick={() => runGeocode()} disabled={busy}>
                    Ophalen uit adres
                  </Button>
                )}
                <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">Overschrijven</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Handmatige locatie</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 mt-2">
                      <Label>Stad of postcode</Label>
                      <Input
                        placeholder="bv. Amsterdam of 1011AA"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Handig wanneer je terras op een andere locatie ligt dan het adres.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setOverrideOpen(false)}>Annuleren</Button>
                      <Button disabled={!query.trim() || busy} onClick={() => runGeocode(query.trim())}>
                        Opzoeken & opslaan
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            {!hasLocation && !hasAddress && (
              <p className="text-xs text-warning">
                Vul je adres in of overschrijf de locatie handmatig om het weer te kunnen tonen.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
