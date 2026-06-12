import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CloudOff, Navigation } from "lucide-react";
import {
  fetchDaily, fetchHourly, currentHour, nextRainAt, interpretCode,
  degToCompass, windLabel,
} from "@/services/weather";

type Props = { restaurantId: string };

/** Tiny arrow rotated to wind direction. Meteorological deg = wind comes FROM that direction,
 *  so the arrow (pointing TO) is rotated by deg + 180. */
function WindArrow({ deg, className = "" }: { deg: number | null; className?: string }) {
  if (deg === null || deg === undefined) return null;
  return (
    <Navigation
      className={`h-3 w-3 ${className}`}
      style={{ transform: `rotate(${(deg + 180) % 360}deg)` }}
      aria-hidden
    />
  );
}

export function WeatherPill({ restaurantId }: Props) {
  const { data: hourly = [] } = useQuery({
    queryKey: ["weather-hourly", restaurantId],
    queryFn: () => fetchHourly(restaurantId),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });
  const { data: daily = [] } = useQuery({
    queryKey: ["weather-daily", restaurantId],
    queryFn: () => fetchDaily(restaurantId),
    enabled: !!restaurantId,
    staleTime: 15 * 60 * 1000,
  });

  if (hourly.length === 0 && daily.length === 0) {
    return null;
  }

  const now = currentHour(hourly);
  const rain = nextRainAt(hourly, 3);
  const interp = interpretCode(now?.condition_code ?? daily[0]?.condition_code);
  const temp = now?.temp_c ?? daily[0]?.max_temp_c;
  const windNow = now?.wind_kmh ?? daily[0]?.wind_kmh_max ?? null;
  const windDir = degToCompass(now?.wind_direction_deg ?? daily[0]?.wind_direction_deg);
  const showWind = (windNow ?? 0) >= 20;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <span aria-hidden className="text-base leading-none">{interp.emoji}</span>
          <span className="font-medium">
            {temp !== null && temp !== undefined ? `${Math.round(temp)}°` : "—"}
          </span>
          {showWind && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <WindArrow deg={now?.wind_direction_deg ?? daily[0]?.wind_direction_deg ?? null} />
              {Math.round(windNow!)} km/u{windDir ? ` ${windDir}` : ""}
            </span>
          )}
          {rain && (
            <span className="text-xs text-muted-foreground">
              · regen {format(new Date(rain.hour_ts), "HH:mm")}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Weer</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Komende 24 uur</h3>
            {hourly.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CloudOff className="h-4 w-4" /> Geen uurdata beschikbaar
              </p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {hourly.slice(0, 24).map((h) => {
                  const ip = interpretCode(h.condition_code);
                  const dir = degToCompass(h.wind_direction_deg);
                  return (
                    <div key={h.id} className="flex flex-col items-center min-w-[60px] rounded-md border bg-card p-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(h.hour_ts), "HH")}u
                      </span>
                      <span className="text-lg leading-none my-1" aria-label={ip.label}>{ip.emoji}</span>
                      <span className="text-sm font-medium">
                        {h.temp_c !== null ? Math.round(h.temp_c) + "°" : "—"}
                      </span>
                      {(h.precipitation_prob_pct ?? 0) > 20 && (
                        <span className="text-[10px] text-primary mt-0.5">
                          {h.precipitation_prob_pct}%
                        </span>
                      )}
                      {(h.wind_kmh ?? 0) >= 10 && (
                        <span className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-0.5">
                          <WindArrow deg={h.wind_direction_deg} />
                          {Math.round(h.wind_kmh!)}{dir ? ` ${dir}` : ""}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Komende 7 dagen</h3>
            <div className="space-y-1">
              {daily.map((d) => {
                const ip = interpretCode(d.condition_code);
                const dir = degToCompass(d.wind_direction_deg);
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/40">
                    <span className="text-sm w-20 capitalize">
                      {format(new Date(d.date + "T12:00:00"), "EEE d MMM", { locale: nl })}
                    </span>
                    <span className="text-lg" aria-label={ip.label}>{ip.emoji}</span>
                    <span className="text-sm text-muted-foreground flex-1 text-right">
                      {d.min_temp_c !== null ? Math.round(d.min_temp_c) : "—"}° / {d.max_temp_c !== null ? Math.round(d.max_temp_c) : "—"}°
                    </span>
                    {(d.wind_kmh_max ?? 0) >= 15 && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1 w-20 justify-end">
                        <WindArrow deg={d.wind_direction_deg} />
                        {Math.round(d.wind_kmh_max!)}{dir ? ` ${dir}` : ""}
                      </span>
                    )}
                    {(d.precipitation_mm ?? 0) > 0.5 && (
                      <span className="text-xs text-primary w-12 text-right">
                        {d.precipitation_mm!.toFixed(1)}mm
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Wind: {windLabel(daily[0]?.wind_kmh_max ?? null).toLowerCase()} vandaag.
            </p>
          </section>

          {daily[0]?.fetched_at && (
            <p className="text-xs text-muted-foreground">
              Bron: Open-Meteo · bijgewerkt {format(new Date(daily[0].fetched_at), "HH:mm")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
