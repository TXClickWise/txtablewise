// Geocode restaurant address via Open-Meteo (no API key). Owner/manager only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const restaurantId = body?.restaurant_id as string | undefined;
    const manualQuery = (body?.query as string | undefined)?.trim();
    if (!restaurantId) return json({ error: "missing restaurant_id" }, 400);

    // Verify caller is owner/manager
    const { data: member } = await supabase
      .from("restaurant_members")
      .select("role")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!member || !["owner", "manager"].includes(member.role)) {
      return json({ error: "forbidden" }, 403);
    }

    const { data: rest, error: restErr } = await supabase
      .from("restaurants")
      .select("address_line1, city, postal_code, weather_location_override")
      .eq("id", restaurantId)
      .maybeSingle();
    if (restErr || !rest) return json({ error: "restaurant not found" }, 404);

    // Open-Meteo geocoding works on place names, not street addresses.
    // Build a list of progressively broader queries and use the first match.
    const candidates: string[] = [];
    if (manualQuery) {
      candidates.push(manualQuery);
      // If a postal code is included, also try just the postal code
      const pcMatch = manualQuery.match(/\b\d{4}\s?[A-Za-z]{2}\b|\b\d{4,5}\b/);
      if (pcMatch) candidates.push(pcMatch[0].replace(/\s+/g, ""));
    } else {
      if (rest.city) candidates.push(rest.city);
      if (rest.postal_code) candidates.push(rest.postal_code.replace(/\s+/g, ""));
      if (rest.address_line1 && rest.city) {
        candidates.push(`${rest.address_line1}, ${rest.city}`);
      }
    }

    const uniqueCandidates = Array.from(new Set(candidates.map((c) => c.trim()).filter(Boolean)));
    if (uniqueCandidates.length === 0) {
      return json({ error: "no address available to geocode" }, 400);
    }

    let hit: any = null;
    let usedQuery = "";
    for (const q of uniqueCandidates) {
      const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
      geoUrl.searchParams.set("name", q);
      geoUrl.searchParams.set("count", "1");
      geoUrl.searchParams.set("language", "nl");
      geoUrl.searchParams.set("format", "json");
      const geoRes = await fetch(geoUrl.toString());
      if (!geoRes.ok) continue;
      const geo = await geoRes.json();
      if (geo?.results?.[0]) {
        hit = geo.results[0];
        usedQuery = q;
        break;
      }
    }
    if (!hit) {
      return json({
        error: "no_match",
        tried: uniqueCandidates,
        hint: "Geef alleen stad of postcode op (bv. 'De Koog' of '1796CG').",
      }, 404);
    }

    const label = manualQuery
      ? `${hit.name}${hit.country_code ? " (" + hit.country_code + ")" : ""}`
      : `${hit.name} (uit adres)`;

    const update: Record<string, unknown> = {
      latitude: hit.latitude,
      longitude: hit.longitude,
      weather_location_label: label,
    };
    if (manualQuery) update.weather_location_override = true;

    const { error: updErr } = await supabase
      .from("restaurants")
      .update(update)
      .eq("id", restaurantId);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({
      latitude: hit.latitude,
      longitude: hit.longitude,
      label,
      name: hit.name,
      country: hit.country,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
