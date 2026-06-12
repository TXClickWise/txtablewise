import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudRain, ThermometerSun, Snowflake, Wind, Sparkles, X, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { fetchActiveAdvisories, dismissAdvisory } from "@/services/weather";

const iconFor = (type: string) => {
  switch (type) {
    case "rain_during_service": return <CloudRain className="h-4 w-4" />;
    case "heatwave": return <ThermometerSun className="h-4 w-4" />;
    case "frost_terrace": return <Snowflake className="h-4 w-4" />;
    case "storm_warning": return <Wind className="h-4 w-4" />;
    case "great_weather_low_bookings": return <Sparkles className="h-4 w-4" />;
    default: return null;
  }
};

const actionLabel = (route: string | null): string => {
  if (!route) return "";
  if (route.startsWith("/app/agenda")) return "Open agenda";
  if (route.startsWith("/app/wachtlijst")) return "Open wachtlijst";
  if (route.startsWith("/app/instellingen/zones")) return "Bekijk zones";
  return "Bekijken";
};

export function AdvisoryStrip({ restaurantId }: { restaurantId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: advisories = [] } = useQuery({
    queryKey: ["weather-advisories", restaurantId],
    queryFn: () => fetchActiveAdvisories(restaurantId),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });

  if (advisories.length === 0) return null;
  const a = advisories[0]; // toon er max 1 tegelijk

  return (
    <Alert variant={a.severity === "warn" ? "destructive" : "default"} className="flex items-start gap-3">
      <div className="mt-0.5">{iconFor(a.type)}</div>
      <div className="flex-1">
        <AlertTitle className="text-sm font-medium">{a.headline_nl}</AlertTitle>
        {a.body_nl && (
          <AlertDescription className="text-sm mt-0.5">{a.body_nl}</AlertDescription>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {a.action_route && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(a.action_route!)}
            className="h-7 gap-1"
          >
            {actionLabel(a.action_route)}
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Sluiten"
          onClick={async () => {
            await dismissAdvisory(a.id);
            qc.invalidateQueries({ queryKey: ["weather-advisories", restaurantId] });
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Alert>
  );
}
