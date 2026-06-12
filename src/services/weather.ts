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
