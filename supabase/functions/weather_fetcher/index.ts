// Periodic weather fetch from Open-Meteo. Service-role; called by pg_cron.
// Optional body: { restaurant_id?: string } to refresh just one restaurant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let onlyRestaurant: string | null = null;
  try {
    if (req.method !== "OPTIONS") {
      const body = await req.json().catch(() => ({}));
      onlyRestaurant = body?.restaurant_id ?? null;
    }
  } catch { /* ignore */ }

  let q = supabase
    .from("restaurants")
    .select("id, latitude, longitude, timezone, weather_enabled")
    .eq("weather_enabled", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (onlyRestaurant) q = q.eq("id", onlyRestaurant);

  const { data: restaurants, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const r of restaurants ?? []) {
    try {
      await fetchAndStoreForRestaurant(supabase, r);
      // Fire-and-forget advisory generation
      await callAdvise(r.id);
      results.push({ id: r.id, ok: true });
    } catch (e) {
      results.push({ id: r.id, ok: false, error: (e as Error).message });
    }
  }

  return json({ count: results.length, results });
});

async function fetchAndStoreForRestaurant(
  supabase: ReturnType<typeof createClient>,
  r: { id: string; latitude: number; longitude: number; timezone: string },
) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(r.latitude));
  url.searchParams.set("longitude", String(r.longitude));
  url.searchParams.set("timezone", r.timezone || "Europe/Amsterdam");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m",
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_min,temperature_2m_max,precipitation_sum,weather_code,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset",
  );

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const data = await res.json();

  // Daily upsert
  const daily = data.daily;
  if (daily?.time?.length) {
    const dailyRows = daily.time.map((d: string, i: number) => ({
      restaurant_id: r.id,
      date: d,
      min_temp_c: daily.temperature_2m_min?.[i] ?? null,
      max_temp_c: daily.temperature_2m_max?.[i] ?? null,
      precipitation_mm: daily.precipitation_sum?.[i] ?? null,
      condition_code: daily.weather_code?.[i] ?? null,
      wind_kmh_max: daily.wind_speed_10m_max?.[i] ?? null,
      uv_index_max: daily.uv_index_max?.[i] ?? null,
      sunrise: daily.sunrise?.[i] ?? null,
      sunset: daily.sunset?.[i] ?? null,
      source: "open-meteo",
      fetched_at: new Date().toISOString(),
    }));
    const { error: dErr } = await supabase
      .from("weather_forecasts")
      .upsert(dailyRows, { onConflict: "restaurant_id,date" });
    if (dErr) throw dErr;
  }

  // Hourly: only today + tomorrow (48h)
  const hourly = data.hourly;
  if (hourly?.time?.length) {
    const now = Date.now();
    const cutoff = now + 48 * 3600 * 1000;
    const rows: any[] = [];
    for (let i = 0; i < hourly.time.length; i++) {
      const t = new Date(hourly.time[i]).getTime();
      if (isNaN(t)) continue;
      if (t < now - 3600 * 1000 || t > cutoff) continue;
      rows.push({
        restaurant_id: r.id,
        hour_ts: new Date(hourly.time[i]).toISOString(),
        temp_c: hourly.temperature_2m?.[i] ?? null,
        precipitation_mm: hourly.precipitation?.[i] ?? null,
        precipitation_prob_pct: hourly.precipitation_probability?.[i] ?? null,
        condition_code: hourly.weather_code?.[i] ?? null,
        wind_kmh: hourly.wind_speed_10m?.[i] ?? null,
        fetched_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error: hErr } = await supabase
        .from("weather_hourly")
        .upsert(rows, { onConflict: "restaurant_id,hour_ts" });
      if (hErr) throw hErr;
    }
    // Prune old hourly rows (> 2h in past)
    await supabase
      .from("weather_hourly")
      .delete()
      .eq("restaurant_id", r.id)
      .lt("hour_ts", new Date(now - 2 * 3600 * 1000).toISOString());
  }
}

async function callAdvise(restaurantId: string) {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/weather_advise`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ restaurant_id: restaurantId }),
    });
  } catch { /* non-fatal */ }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
