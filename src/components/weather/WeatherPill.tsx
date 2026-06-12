import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CloudOff, Navigation, Thermometer, Umbrella, Wind } from "lucide-react";
import {
  fetchDaily, fetchHourly, currentHour, nextRainAt, interpretCode,
  degToCompass, compassLong, beaufort,
  type WeatherHourly,
} from "@/services/weather";

type Props = { restaurantId: string };

/** Arrow rotated to wind direction.
 *  Meteorological deg = wind comes FROM that direction, arrow points TO → rotate deg + 180. */
function WindArrow({ deg, className = "h-3.5 w-3.5" }: { deg: number | null | undefined; className?: string }) {
  if (deg === null || deg === undefined) return null;
  return (
    <Navigation
      className={className}
      style={{ transform: `rotate(${(deg + 180) % 360}deg)` }}
      aria-hidden
    />
  );
}

function strongestHourlyDirectionForDay(hourly: WeatherHourly[], date: string): number | null {
  let strongest: WeatherHourly | null = null;
  for (const h of hourly) {
    if (h.hour_ts.slice(0, 10) !== date) continue;
    if (h.wind_direction_deg === null || h.wind_direction_deg === undefined) continue;
    if ((h.wind_kmh ?? -1) > (strongest?.wind_kmh ?? -1)) strongest = h;
  }
  return strongest?.wind_direction_deg ?? null;
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

  if (hourly.length === 0 && daily.length === 0) return null;

  const now = currentHour(hourly);
  const rain = nextRainAt(hourly, 3);
  const interp = interpretCode(now?.condition_code ?? daily[0]?.condition_code);
  const temp = now?.temp_c ?? daily[0]?.max_temp_c;
  const windNow = now?.wind_kmh ?? daily[0]?.wind_kmh_max ?? null;
  const todayDirectionDeg = now?.wind_direction_deg ?? daily[0]?.wind_direction_deg ?? strongestHourlyDirectionForDay(hourly, daily[0]?.date ?? new Date().toISOString().slice(0, 10));
  const windDirCompact = degToCompass(todayDirectionDeg);
  const bftNow = beaufort(windNow);
  const hasWind = windNow !== null && windNow !== undefined;

  const todayDaily = daily[0];
  const todayWindMax = todayDaily?.wind_kmh_max ?? null;
  const todayBft = beaufort(todayWindMax);
  const todayWindLong = compassLong(todayDirectionDeg);

  // Peak wind hour today
  const todayStr = new Date().toISOString().slice(0, 10);
  let peak: WeatherHourly | null = null;
  for (const h of hourly) {
    if (h.hour_ts.slice(0, 10) !== todayStr) continue;
    if ((h.wind_kmh ?? -1) > (peak?.wind_kmh ?? -1)) peak = h;
  }

  const hours24 = hourly.slice(0, 24);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <span aria-hidden className="text-base leading-none">{interp.emoji}</span>
          <span className="font-medium">
            {temp !== null && temp !== undefined ? `${Math.round(temp)}°` : "—"}
          </span>
          {hasWind && (
            <span className={`text-xs inline-flex items-center gap-1 ${bftNow.textClass}`}>
              <WindArrow deg={todayDirectionDeg} className="h-3.5 w-3.5" />
              Wind: {windDirCompact ?? "—"} · {bftNow.name}
            </span>
          )}
          {rain && (
            <span className="text-xs text-muted-foreground">
              · regen {format(new Date(rain.hour_ts), "HH:mm")}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Weer</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* ── 24-uur strip ─────────────────────────────────────────── */}
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
                        <th className="sticky left-0 z-10 bg-card w-11 min-w-11 px-2 py-1.5 border-b" aria-label="Metriek" />
                        {hours24.map((h) => (
                          <th
                            key={h.id + "-h"}
                            className="w-12 min-w-12 px-1 py-1.5 text-center text-[11px] font-medium text-muted-foreground border-b"
                          >
                            {format(new Date(h.hour_ts), "HH")}u
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Conditie */}
                      <tr>
                        <td className="sticky left-0 z-10 bg-card w-11 min-w-11 px-2 py-1.5 border-b text-muted-foreground">
                          <span className="text-base leading-none" aria-label="Conditie">☁️</span>
                        </td>
                        {hours24.map((h) => {
                          const ip = interpretCode(h.condition_code);
                          return (
                            <td key={h.id + "-c"} className="w-12 min-w-12 px-1 py-1.5 text-center border-b">
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
                          <td key={h.id + "-t"} className="w-12 min-w-12 px-1 py-1.5 text-center text-sm font-medium tabular-nums border-b">
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
                            className={`w-12 min-w-12 px-1 py-1.5 text-center text-xs tabular-nums border-b ${
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

                      {/* Wind — Beaufort badge + richting */}
                      <tr>
                        <td className="sticky left-0 z-10 bg-card w-11 min-w-11 px-2 py-1.5">
                          <Wind className="h-3.5 w-3.5 text-muted-foreground" aria-label="Wind (Beaufort)" />
                        </td>
                        {hours24.map((h) => {
                          const dir = degToCompass(h.wind_direction_deg);
                          const bft = beaufort(h.wind_kmh);
                          if (h.wind_kmh === null || h.wind_kmh === undefined) {
                            return (
                              <td key={h.id + "-w"} className="w-12 min-w-12 px-1 py-1.5 text-center text-xs text-muted-foreground">—</td>
                            );
                          }
                          return (
                            <td key={h.id + "-w"} className="w-12 min-w-12 px-1 py-1.5 text-center">
                              <span className="inline-flex flex-col items-center gap-0.5">
                                <span
                                  className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1 rounded text-[11px] font-semibold tabular-nums ${bft.bgClass}`}
                                  title={`${bft.name} (Bft ${bft.bft}) — ${Math.round(h.wind_kmh)} km/u`}
                                >
                                  {bft.bft}
                                </span>
                                <span className="inline-flex items-center gap-0.5 text-[10px] leading-none text-muted-foreground">
                                  <WindArrow deg={h.wind_direction_deg} className="h-2.5 w-2.5" />
                                  {dir ?? "—"}
                                </span>
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t">
                  Wind: Beaufort-getal (0 = windstil, 12 = orkaan) + windrichting
                </div>
              </div>
            )}
          </section>

          {/* ── 7-dagen tabel ────────────────────────────────────────── */}
          <section>
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Komende 7 dagen
            </h3>

            <div className="rounded-md border bg-card overflow-x-auto">
              <div className="min-w-[38rem] divide-y">
              {/* Header */}
              <div className="grid grid-cols-[6.5rem_3rem_5rem_4.5rem_5rem_7.5rem] items-center gap-2 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Dag</span>
                <span className="text-center" aria-label="Weer">Weer</span>
                <span className="text-center">Min / Max</span>
                <span className="text-right">Regen</span>
                <span className="text-center">Richting</span>
                <span className="text-right">Wind</span>
              </div>

              {daily.map((d, i) => {
                const ip = interpretCode(d.condition_code);
                const directionDeg = d.wind_direction_deg ?? strongestHourlyDirectionForDay(hourly, d.date);
                const dir = degToCompass(directionDeg);
                const bft = beaufort(d.wind_kmh_max);
                return (
                  <div
                    key={d.id}
                    className={`grid grid-cols-[6.5rem_3rem_5rem_4.5rem_5rem_7.5rem] items-center gap-2 px-3 min-h-11 py-2 text-sm ${
                      i === 0 ? "bg-muted/40" : ""
                    }`}
                  >
                    <span className="capitalize truncate">
                      {format(new Date(d.date + "T12:00:00"), "EEE d MMM", { locale: nl })}
                    </span>
                    <span className="text-center text-lg leading-none" aria-label={ip.label}>{ip.emoji}</span>
                    <span className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
                      {d.min_temp_c !== null ? Math.round(d.min_temp_c) : "—"}° / {d.max_temp_c !== null ? Math.round(d.max_temp_c) : "—"}°
                    </span>
                    <span className={`text-right text-xs tabular-nums ${(d.precipitation_mm ?? 0) >= 0.5 ? "text-primary" : "text-muted-foreground"}`}>
                      {(d.precipitation_mm ?? 0) >= 0.5 ? `${d.precipitation_mm!.toFixed(1)}mm` : "—"}
                    </span>
                    <span className="text-xs inline-flex items-center justify-center gap-1 text-muted-foreground">
                      {directionDeg !== null && directionDeg !== undefined ? (
                        <>
                          <WindArrow deg={directionDeg} className="h-3 w-3" />
                          <span className="font-medium tabular-nums">{dir ?? "—"}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="text-right text-xs inline-flex items-center justify-end">
                      {d.wind_kmh_max !== null && d.wind_kmh_max !== undefined ? (
                        <span
                          className={`inline-flex items-center justify-center w-full max-w-[6.5rem] h-5 rounded px-1.5 text-[11px] font-medium whitespace-nowrap ${bft.bgClass}`}
                          title={`Bft ${bft.bft} — tot ${Math.round(d.wind_kmh_max)} km/u uit ${dir ?? "onbekende richting"}`}
                        >
                          {bft.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  </div>
                );
              })}
              </div>
            </div>
          </section>

          {/* ── Wind-context ─────────────────────────────────────────── */}
          {todayWindMax !== null && (
            <section className={`flex items-start gap-3 rounded-md border-l-4 border bg-card px-3 py-2.5 ${todayBft.borderClass}`}>
              <Wind className={`h-4 w-4 mt-0.5 shrink-0 ${todayBft.textClass}`} aria-hidden />
              <div className="text-sm">
                <div className="font-medium">Wind vandaag</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  <span className={todayBft.textClass}>{todayBft.name} (Bft {todayBft.bft})</span>
                  {todayWindLong ? ` uit ${todayWindLong}` : ""}
                </div>
                {peak && peak.wind_kmh !== null && (
                  <div className="text-muted-foreground text-xs mt-0.5">
                    Piek {Math.round(peak.wind_kmh)} km/u rond {format(new Date(peak.hour_ts), "HH:mm")}
                  </div>
                )}
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
