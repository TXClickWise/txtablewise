import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CloudOff, Navigation, Thermometer, Umbrella, Wind } from "lucide-react";
import {
  fetchDaily, fetchHourly, currentHour, nextRainAt, interpretCode,
  degToCompass, windLabel,
} from "@/services/weather";

type Props = { restaurantId: string };

/** Tiny arrow rotated to wind direction.
 *  Meteorological deg = wind comes FROM that direction, arrow points TO → rotate deg + 180. */
function WindArrow({ deg, className = "" }: { deg: number | null | undefined; className?: string }) {
  if (deg === null || deg === undefined) return null;
  return (
    <Navigation
      className={`h-3 w-3 ${className}`}
      style={{ transform: `rotate(${(deg + 180) % 360}deg)` }}
      aria-hidden
    />
  );
}

const COMPASS_NL_LONG: Record<string, string> = {
  N: "het noorden",
  NO: "het noordoosten",
  O: "het oosten",
  ZO: "het zuidoosten",
  Z: "het zuiden",
  ZW: "het zuidwesten",
  W: "het westen",
  NW: "het noordwesten",
};

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

  if (hourly.length === 0 && daily.length === 0) return null;

  const now = currentHour(hourly);
  const rain = nextRainAt(hourly, 3);
  const interp = interpretCode(now?.condition_code ?? daily[0]?.condition_code);
  const temp = now?.temp_c ?? daily[0]?.max_temp_c;
  const windNow = now?.wind_kmh ?? daily[0]?.wind_kmh_max ?? null;
  const windDirCompact = degToCompass(now?.wind_direction_deg ?? daily[0]?.wind_direction_deg);
  const showWind = (windNow ?? 0) >= 20;

  const todayDaily = daily[0];
  const todayWindMax = todayDaily?.wind_kmh_max ?? null;
  const todayWindDir = degToCompass(todayDaily?.wind_direction_deg);
  const todayWindLabel = windLabel(todayWindMax);
  const todayWindLong = todayWindDir ? COMPASS_NL_LONG[todayWindDir] : null;

  const hours24 = hourly.slice(0, 24);

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
              <WindArrow deg={now?.wind_direction_deg ?? todayDaily?.wind_direction_deg} />
              {Math.round(windNow!)} km/u{windDirCompact ? ` ${windDirCompact}` : ""}
            </span>
          )}
          {rain && (
            <span className="text-xs text-muted-foreground">
              · regen {format(new Date(rain.hour_ts), "HH:mm")}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Weer</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* ── 24-uur strip met sticky metric labels ─────────────────── */}
          <section>
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Komende 24 uur
            </h3>

            {hours24.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CloudOff className="h-4 w-4" /> Geen uurdata beschikbaar
              </p>
            ) : (
              <div className="rounded-md border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th
                          className="sticky left-0 z-10 bg-card w-11 min-w-11 px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground border-b"
                          aria-label="Metriek"
                        />
                        {hours24.map((h) => (
                          <th
                            key={h.id + "-h"}
                            className="w-11 min-w-11 px-1 py-1.5 text-center text-[11px] font-medium text-muted-foreground border-b"
                          >
                            {format(new Date(h.hour_ts), "HH")}u
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Conditie iconen */}
                      <tr>
                        <td className="sticky left-0 z-10 bg-card w-11 min-w-11 px-2 py-1.5 border-b text-muted-foreground">
                          <span className="text-base leading-none" aria-label="Conditie">☁️</span>
                        </td>
                        {hours24.map((h) => {
                          const ip = interpretCode(h.condition_code);
                          return (
                            <td key={h.id + "-c"} className="w-11 min-w-11 px-1 py-1.5 text-center border-b">
                              <span className="text-base leading-none" aria-label={ip.label}>{ip.emoji}</span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Temperatuur */}
                      <tr>
                        <td className="sticky left-0 z-10 bg-card w-11 min-w-11 px-2 py-1.5 border-b">
                          <Thermometer className="h-3.5 w-3.5 text-muted-foreground" aria-label="Temperatuur" />
                        </td>
                        {hours24.map((h) => (
                          <td key={h.id + "-t"} className="w-11 min-w-11 px-1 py-1.5 text-center text-sm font-medium tabular-nums border-b">
                            {h.temp_c !== null ? `${Math.round(h.temp_c)}°` : "—"}
                          </td>
                        ))}
                      </tr>

                      {/* Regenkans */}
                      <tr>
                        <td className="sticky left-0 z-10 bg-card w-11 min-w-11 px-2 py-1.5 border-b">
                          <Umbrella className="h-3.5 w-3.5 text-muted-foreground" aria-label="Regenkans" />
                        </td>
                        {hours24.map((h) => (
                          <td
                            key={h.id + "-r"}
                            className={`w-11 min-w-11 px-1 py-1.5 text-center text-xs tabular-nums border-b ${
                              (h.precipitation_prob_pct ?? 0) >= 60
                                ? "text-primary font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            {(h.precipitation_prob_pct ?? 0) >= 20
                              ? `${h.precipitation_prob_pct}%`
                              : "—"}
                          </td>
                        ))}
                      </tr>

                      {/* Wind */}
                      <tr>
                        <td className="sticky left-0 z-10 bg-card w-11 min-w-11 px-2 py-1.5">
                          <Wind className="h-3.5 w-3.5 text-muted-foreground" aria-label="Wind" />
                        </td>
                        {hours24.map((h) => {
                          const dir = degToCompass(h.wind_direction_deg);
                          const kmh = h.wind_kmh;
                          if (kmh === null || kmh === undefined) {
                            return (
                              <td key={h.id + "-w"} className="w-11 min-w-11 px-1 py-1.5 text-center text-xs text-muted-foreground">—</td>
                            );
                          }
                          const strong = kmh >= 50;
                          return (
                            <td
                              key={h.id + "-w"}
                              className={`w-11 min-w-11 px-1 py-1.5 text-center text-xs tabular-nums ${
                                strong ? "text-destructive font-medium" : "text-muted-foreground"
                              }`}
                            >
                              <span className="inline-flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-0.5">
                                  <WindArrow deg={h.wind_direction_deg} />
                                  {Math.round(kmh)}
                                </span>
                                {kmh >= 20 && dir && (
                                  <span className="text-[10px] leading-none">{dir}</span>
                                )}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* ── 7-dagen tabel ────────────────────────────────────────── */}
          <section>
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Komende 7 dagen
            </h3>

            <div className="rounded-md border bg-card divide-y">
              {/* Header */}
              <div className="grid grid-cols-[5rem_2rem_minmax(0,1fr)_3.5rem_4.5rem] items-center gap-2 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Dag</span>
                <span className="text-center" aria-label="Weer">Weer</span>
                <span className="text-right">Min / Max</span>
                <span className="text-right">Regen</span>
                <span className="text-right">Wind</span>
              </div>

              {daily.map((d, i) => {
                const ip = interpretCode(d.condition_code);
                const dir = degToCompass(d.wind_direction_deg);
                const wind = d.wind_kmh_max;
                const strongWind = (wind ?? 0) >= 50;
                return (
                  <div
                    key={d.id}
                    className={`grid grid-cols-[5rem_2rem_minmax(0,1fr)_3.5rem_4.5rem] items-center gap-2 px-3 h-11 text-sm ${
                      i === 0 ? "bg-muted/40" : ""
                    }`}
                  >
                    <span className="capitalize truncate">
                      {format(new Date(d.date + "T12:00:00"), "EEE d MMM", { locale: nl })}
                    </span>
                    <span className="text-center text-lg leading-none" aria-label={ip.label}>{ip.emoji}</span>
                    <span className="text-right text-muted-foreground tabular-nums">
                      {d.min_temp_c !== null ? Math.round(d.min_temp_c) : "—"}° / {d.max_temp_c !== null ? Math.round(d.max_temp_c) : "—"}°
                    </span>
                    <span className={`text-right text-xs tabular-nums ${(d.precipitation_mm ?? 0) >= 0.5 ? "text-primary" : "text-muted-foreground"}`}>
                      {(d.precipitation_mm ?? 0) >= 0.5 ? `${d.precipitation_mm!.toFixed(1)}mm` : "—"}
                    </span>
                    <span className={`text-right text-xs tabular-nums inline-flex items-center justify-end gap-1 ${strongWind ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {wind !== null && wind !== undefined ? (
                        <>
                          <WindArrow deg={d.wind_direction_deg} />
                          {Math.round(wind)}{dir ? ` ${dir}` : ""}
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Wind-context ─────────────────────────────────────────── */}
          {todayWindMax !== null && (
            <section className="flex items-start gap-3 rounded-md border bg-card px-3 py-2.5">
              <Wind className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
              <div className="text-sm">
                <div className="font-medium">Wind vandaag</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {todayWindLabel} (tot {Math.round(todayWindMax)} km/u
                  {todayWindLong ? ` uit ${todayWindLong}` : ""})
                </div>
              </div>
            </section>
          )}

          {daily[0]?.fetched_at && (
            <p className="text-xs text-muted-foreground pt-3 border-t">
              Bron: Open-Meteo · bijgewerkt {format(new Date(daily[0].fetched_at), "HH:mm")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
