import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CloudOff } from "lucide-react";
import {
  fetchDaily, fetchHourly, currentHour, nextRainAt, interpretCode,
} from "@/services/weather";

type Props = { restaurantId: string };

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

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <span aria-hidden className="text-base leading-none">{interp.emoji}</span>
          <span className="font-medium">
            {temp !== null && temp !== undefined ? `${Math.round(temp)}°` : "—"}
          </span>
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
                  return (
                    <div key={h.id} className="flex flex-col items-center min-w-[56px] rounded-md border bg-card p-2">
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
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/40">
                    <span className="text-sm w-20 capitalize">
                      {format(new Date(d.date + "T12:00:00"), "EEE d MMM", { locale: nl })}
                    </span>
                    <span className="text-lg" aria-label={ip.label}>{ip.emoji}</span>
                    <span className="text-sm text-muted-foreground flex-1 text-right">
                      {d.min_temp_c !== null ? Math.round(d.min_temp_c) : "—"}° / {d.max_temp_c !== null ? Math.round(d.max_temp_c) : "—"}°
                    </span>
                    {(d.precipitation_mm ?? 0) > 0.5 && (
                      <span className="text-xs text-primary w-12 text-right">
                        {d.precipitation_mm!.toFixed(1)}mm
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
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
