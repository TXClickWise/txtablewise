// Rule-engine for stille weer-tips. Only generates an advisory if a rule fires.
// AI (Lovable Gateway) is only called to rephrase the headline/body when triggered.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

type Advisory = {
  type: "rain_during_service" | "heatwave" | "frost_terrace" | "great_weather_low_bookings" | "storm_warning" | "terrace_breeze_warning";
  date: string; // YYYY-MM-DD
  severity: "info" | "warn";
  headline_nl: string;
  body_nl: string | null;
  action_route: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = await req.json().catch(() => ({}));
  const restaurantId = body?.restaurant_id as string | undefined;
  if (!restaurantId) return json({ error: "missing restaurant_id" }, 400);

  const { data: rest } = await supabase
    .from("restaurants")
    .select("id, timezone, weather_enabled, plan")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!rest || !rest.weather_enabled) return json({ skipped: true });

  const tz = rest.timezone || "Europe/Amsterdam";
  const today = todayInTz(tz);
  const tomorrow = addDays(today, 1);

  const [{ data: daily }, { data: hourly }, { data: zones }] = await Promise.all([
    supabase.from("weather_forecasts").select("*").eq("restaurant_id", restaurantId).gte("date", today).order("date"),
    supabase.from("weather_hourly").select("*").eq("restaurant_id", restaurantId).order("hour_ts"),
    supabase.from("zones").select("id, name, is_terrace, weather_dependent").eq("restaurant_id", restaurantId).eq("is_active", true),
  ]);

  const advisories: Advisory[] = [];
  const hasTerrace = (zones ?? []).some((z) => z.is_terrace);

  // Rule 1: rain during service today (next 6h with >0.5mm and >60% prob)
  const next6 = (hourly ?? []).filter((h) => {
    const t = new Date(h.hour_ts).getTime();
    return t >= Date.now() && t <= Date.now() + 6 * 3600 * 1000;
  });
  const rainHour = next6.find((h) => (h.precipitation_mm ?? 0) > 0.5 && (h.precipitation_prob_pct ?? 0) > 60);
  if (rainHour && hasTerrace) {
    const startsAt = new Date(rainHour.hour_ts);
    const hhmm = formatHHMM(startsAt, tz);
    advisories.push({
      type: "rain_during_service",
      date: today,
      severity: "warn",
      headline_nl: `Regen vanaf ${hhmm} — check je terrasgasten.`,
      body_nl: "Overweeg om terrasreserveringen een binnen-alternatief te bieden.",
      action_route: `/app/agenda?date=${today}`,
    });
  }

  // Rule 2: heatwave in next 5 days (max >= 28)
  const heat = (daily ?? []).slice(0, 5).find((d) => (d.max_temp_c ?? 0) >= 28);
  if (heat) {
    advisories.push({
      type: "heatwave",
      date: heat.date,
      severity: "info",
      headline_nl: `Warme dag op ${formatDateNl(heat.date)} (tot ${Math.round(heat.max_temp_c)}°C).`,
      body_nl: "Zet extra karaffen water klaar en overweeg vroege schaduw op het terras.",
      action_route: null,
    });
  }

  // Rule 3: frost tomorrow + weather-dependent terrace zone
  const tomorrowDaily = (daily ?? []).find((d) => d.date === tomorrow);
  const weatherDepTerrace = (zones ?? []).some((z) => z.is_terrace && z.weather_dependent);
  if (tomorrowDaily && (tomorrowDaily.min_temp_c ?? 99) <= 2 && weatherDepTerrace) {
    advisories.push({
      type: "frost_terrace",
      date: tomorrow,
      severity: "info",
      headline_nl: `Vorst voor morgen (${Math.round(tomorrowDaily.min_temp_c)}°C).`,
      body_nl: "Je weersafhankelijke terraszones worden morgen automatisch overgeslagen.",
      action_route: "/app/instellingen/zones",
    });
  }

  // Rule 4: storm warning (wind >=50 km/h today or tomorrow)
  const stormDay = (daily ?? []).slice(0, 2).find((d) => (d.wind_kmh_max ?? 0) >= 50);
  if (stormDay) {
    const dir = degToCompassNl(stormDay.wind_direction_deg);
    advisories.push({
      type: "storm_warning",
      date: stormDay.date,
      severity: "warn",
      headline_nl: `Harde ${dir ? dir + "-" : ""}wind verwacht op ${formatDateNl(stormDay.date)} (${Math.round(stormDay.wind_kmh_max)} km/u).`,
      body_nl: hasTerrace ? "Beperk terrasreserveringen of zet tafels eerder binnen." : null,
      action_route: null,
    });
  } else if (hasTerrace) {
    // Rule 4b: stevige bries (35-49 km/u) tijdens shift met terras
    const breezeDay = (daily ?? []).slice(0, 2).find((d) => (d.wind_kmh_max ?? 0) >= 35 && (d.wind_kmh_max ?? 0) < 50);
    if (breezeDay) {
      const dir = degToCompassNl(breezeDay.wind_direction_deg);
      advisories.push({
        type: "terrace_breeze_warning",
        date: breezeDay.date,
        severity: "info",
        headline_nl: `Stevige ${dir ? dir + "-" : ""}wind op ${formatDateNl(breezeDay.date)} (tot ${Math.round(breezeDay.wind_kmh_max)} km/u).`,
        body_nl: "Zet windschermen klaar en verzwaar losse spullen op het terras.",
        action_route: null,
      });
    }
  }

  // Rule 5: great weather weekend + low occupancy
  const weekendGood = (daily ?? []).find((d) => {
    const dt = new Date(d.date + "T12:00:00");
    const dow = dt.getDay();
    return (
      (dow === 5 || dow === 6 || dow === 0) &&
      (d.max_temp_c ?? 0) >= 20 && (d.max_temp_c ?? 0) <= 30 &&
      (d.precipitation_mm ?? 0) < 1
    );
  });
  if (weekendGood) {
    // Check occupancy for that day
    const dayStart = `${weekendGood.date}T00:00:00Z`;
    const dayEnd = `${weekendGood.date}T23:59:59Z`;
    const { count } = await supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd)
      .in("status", ["confirmed", "seated", "completed"]);
    if ((count ?? 0) < 5) {
      advisories.push({
        type: "great_weather_low_bookings",
        date: weekendGood.date,
        severity: "info",
        headline_nl: `Mooi weer voorspeld op ${formatDateNl(weekendGood.date)} (${Math.round(weekendGood.max_temp_c)}°C).`,
        body_nl: "Nog weinig reserveringen — overweeg een korte campagne of zet de wachtlijst open.",
        action_route: "/app/wachtlijst",
      });
    }
  }

  // Optional: AI polish via Lovable Gateway
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const aiPolished = apiKey && advisories.length > 0
    ? await polishWithAi(advisories, apiKey).catch(() => null)
    : null;

  // Upsert each advisory (idempotent by (restaurant_id, date, type))
  for (const a of advisories) {
    const polished = aiPolished?.find((p) => p.type === a.type);
    const headline = polished?.headline_nl ?? a.headline_nl;
    const body_nl = polished?.body_nl ?? a.body_nl;
    await supabase
      .from("weather_advisories")
      .upsert(
        {
          restaurant_id: restaurantId,
          date: a.date,
          type: a.type,
          severity: a.severity,
          headline_nl: headline,
          body_nl,
          action_route: a.action_route,
          ai_generated: !!polished,
        },
        { onConflict: "restaurant_id,date,type" },
      );
  }

  return json({ generated: advisories.length, types: advisories.map((a) => a.type) });
});

async function polishWithAi(items: Advisory[], apiKey: string): Promise<Advisory[] | null> {
  const sys = "Je bent een hospitality-copywriter voor een restaurant-OS. Herschrijf elke weer-tip naar maximaal 2 korte Nederlandse zinnen: rustig, concreet, geen jargon, geen emoji. Antwoord uitsluitend met JSON: een array {type, headline_nl, body_nl}.";
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(items) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed.items ?? parsed.advisories ?? null;
    if (!Array.isArray(arr)) return null;
    return arr;
  } catch {
    return null;
  }
}

function todayInTz(tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}
function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function formatHHMM(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("nl-NL", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
function formatDateNl(ymd: string): string {
  const d = new Date(ymd + "T12:00:00Z");
  return new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" }).format(d);
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
