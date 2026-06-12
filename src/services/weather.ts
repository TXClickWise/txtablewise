// Weather service — read-only fetches + helpers.
import { supabase } from "@/integrations/supabase/client";

export type WeatherDaily = {
  id: string;
  date: string;
  min_temp_c: number | null;
  max_temp_c: number | null;
  precipitation_mm: number | null;
  condition_code: number | null;
  wind_kmh_max: number | null;
  wind_direction_deg: number | null;
  uv_index_max: number | null;
  sunrise: string | null;
  sunset: string | null;
  fetched_at: string;
};

export type WeatherHourly = {
  id: string;
  hour_ts: string;
  temp_c: number | null;
  precipitation_mm: number | null;
  precipitation_prob_pct: number | null;
  condition_code: number | null;
  wind_kmh: number | null;
  wind_direction_deg: number | null;
};

export type WeatherAdvisory = {
  id: string;
  date: string;
  type: string;
  severity: "info" | "warn";
  headline_nl: string;
  body_nl: string | null;
  action_route: string | null;
  ai_generated: boolean;
  dismissed_at: string | null;
};

export async function fetchDaily(restaurantId: string): Promise<WeatherDaily[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("weather_forecasts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("date", today)
    .order("date")
    .limit(7);
  return (data as any) ?? [];
}

export async function fetchHourly(restaurantId: string): Promise<WeatherHourly[]> {
  const { data } = await supabase
    .from("weather_hourly")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("hour_ts");
  return (data as any) ?? [];
}

export async function fetchActiveAdvisories(restaurantId: string): Promise<WeatherAdvisory[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("weather_advisories")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("date", today)
    .is("dismissed_at", null)
    .order("date");
  return (data as any) ?? [];
}

export async function dismissAdvisory(advisoryId: string) {
  await supabase
    .from("weather_advisories")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", advisoryId);
}

export function interpretCode(code: number | null | undefined): { label: string; emoji: string } {
  if (code === null || code === undefined) return { label: "Onbekend", emoji: "·" };
  if (code === 0) return { label: "Helder", emoji: "☀️" };
  if (code <= 2) return { label: "Vooral helder", emoji: "🌤️" };
  if (code === 3) return { label: "Bewolkt", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "Mist", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Motregen", emoji: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Regen", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Sneeuw", emoji: "🌨️" };
  if (code >= 80 && code <= 82) return { label: "Buien", emoji: "🌦️" };
  if (code >= 85 && code <= 86) return { label: "Sneeuwbuien", emoji: "🌨️" };
  if (code >= 95) return { label: "Onweer", emoji: "⛈️" };
  return { label: "Wisselend", emoji: "🌥️" };
}

/** Next hour with rain >0.5mm and >60% prob within `hours` from now. */
export function nextRainAt(hourly: WeatherHourly[], hours = 6): WeatherHourly | null {
  const now = Date.now();
  const cutoff = now + hours * 3600 * 1000;
  return (
    hourly.find((h) => {
      const t = new Date(h.hour_ts).getTime();
      return (
        t >= now &&
        t <= cutoff &&
        (h.precipitation_mm ?? 0) > 0.5 &&
        (h.precipitation_prob_pct ?? 0) > 60
      );
    }) ?? null
  );
}

export function currentHour(hourly: WeatherHourly[]): WeatherHourly | null {
  const now = Date.now();
  let best: WeatherHourly | null = null;
  let bestDiff = Infinity;
  for (const h of hourly) {
    const diff = Math.abs(new Date(h.hour_ts).getTime() - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = h;
    }
  }
  return best;
}

/** Compass direction (NL abbreviations) from meteorological degrees (direction the wind is coming FROM). */
export function degToCompass(deg: number | null | undefined): string | null {
  if (deg === null || deg === undefined || Number.isNaN(deg)) return null;
  const dirs = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

/** Short Beaufort-ish label for wind speed in km/h. */
export function windLabel(kmh: number | null | undefined): string {
  if (kmh === null || kmh === undefined) return "—";
  if (kmh < 12) return "Zwak";
  if (kmh < 28) return "Matig";
  if (kmh < 50) return "Krachtig";
  if (kmh < 75) return "Hard";
  return "Storm";
}

export type Beaufort = {
  bft: number;
  name: string;
  /** Tailwind text color class — design tokens / standard palette only. */
  textClass: string;
  /** Tailwind bg color class for badges. */
  bgClass: string;
  /** Border color class for accent bands. */
  borderClass: string;
};

/** Official Beaufort scale (KNMI, km/h thresholds). */
export function beaufort(kmh: number | null | undefined): Beaufort {
  if (kmh === null || kmh === undefined || Number.isNaN(kmh)) {
    return { bft: 0, name: "Onbekend", textClass: "text-muted-foreground", bgClass: "bg-muted", borderClass: "border-muted" };
  }
  const k = Math.round(kmh);
  if (k < 1)   return { bft: 0,  name: "Windstil",        textClass: "text-muted-foreground", bgClass: "bg-muted",       borderClass: "border-muted" };
  if (k <= 5)  return { bft: 1,  name: "Zwak",            textClass: "text-muted-foreground", bgClass: "bg-muted",       borderClass: "border-muted" };
  if (k <= 11) return { bft: 2,  name: "Zwak",            textClass: "text-muted-foreground", bgClass: "bg-muted",       borderClass: "border-muted" };
  if (k <= 19) return { bft: 3,  name: "Matig",           textClass: "text-sky-600 dark:text-sky-400",   bgClass: "bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300",     borderClass: "border-sky-500" };
  if (k <= 28) return { bft: 4,  name: "Matig",           textClass: "text-sky-700 dark:text-sky-300",   bgClass: "bg-sky-200 dark:bg-sky-900 text-sky-800 dark:text-sky-200",    borderClass: "border-sky-600" };
  if (k <= 38) return { bft: 5,  name: "Vrij krachtig",   textClass: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300", borderClass: "border-amber-500" };
  if (k <= 49) return { bft: 6,  name: "Krachtig",        textClass: "text-amber-700 dark:text-amber-300", bgClass: "bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200", borderClass: "border-amber-600" };
  if (k <= 61) return { bft: 7,  name: "Hard",            textClass: "text-orange-600 dark:text-orange-400", bgClass: "bg-orange-200 dark:bg-orange-900 text-orange-800 dark:text-orange-200", borderClass: "border-orange-600" };
  if (k <= 74) return { bft: 8,  name: "Stormachtig",       textClass: "text-destructive",                  bgClass: "bg-destructive/15 text-destructive",                          borderClass: "border-destructive" };
  if (k <= 88) return { bft: 9,  name: "Storm",             textClass: "text-destructive",                  bgClass: "bg-destructive/20 text-destructive",                          borderClass: "border-destructive" };
  if (k <= 102)return { bft: 10, name: "Zware storm",       textClass: "text-destructive font-semibold",    bgClass: "bg-destructive/25 text-destructive",                          borderClass: "border-destructive" };
  if (k <= 117)return { bft: 11, name: "Zeer zware storm",  textClass: "text-purple-700 dark:text-purple-300 font-semibold", bgClass: "bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200", borderClass: "border-purple-700" };
  return         { bft: 12, name: "Orkaan",            textClass: "text-purple-800 dark:text-purple-200 font-bold",     bgClass: "bg-purple-300 dark:bg-purple-800 text-purple-950 dark:text-purple-100", borderClass: "border-purple-800" };
}

/** Full Dutch compass phrase ("het noordoosten") from degrees. */
export function compassLong(deg: number | null | undefined): string | null {
  const c = degToCompass(deg);
  if (!c) return null;
  const map: Record<string, string> = {
    N: "het noorden", NO: "het noordoosten", O: "het oosten", ZO: "het zuidoosten",
    Z: "het zuiden", ZW: "het zuidwesten", W: "het westen", NW: "het noordwesten",
  };
  return map[c] ?? null;
}
