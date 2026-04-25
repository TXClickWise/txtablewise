// Seed demo data for a restaurant: zones, tables, opening hours, shifts.
// Auth required: caller must be a member of the restaurant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const { restaurant_id } = await req.json();
    if (!restaurant_id) return json({ error: "restaurant_id required" }, 400);

    // Verify membership (manager+)
    const { data: membership } = await supabase
      .from("restaurant_members")
      .select("role")
      .eq("restaurant_id", restaurant_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!membership || !["owner", "manager"].includes(membership.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    // Skip if already seeded (any tables exist)
    const { count } = await supabase
      .from("tables").select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurant_id);
    if ((count ?? 0) > 0) return json({ ok: true, skipped: true, reason: "Already seeded" });

    // Zones
    const { data: zones } = await supabase.from("zones").insert([
      { restaurant_id, name: "Hoofdzaal", sort_order: 1 },
      { restaurant_id, name: "Terras", sort_order: 2 },
      { restaurant_id, name: "Privé", sort_order: 3 },
    ]).select("*");

    const zoneMap: Record<string, string> = {};
    for (const z of zones ?? []) zoneMap[z.name] = z.id;

    // Tables
    const tables = [
      // Hoofdzaal
      { label: "1", capacity_min: 1, capacity_max: 2, pos_x: 80, pos_y: 80, shape: "round", zone: "Hoofdzaal" },
      { label: "2", capacity_min: 1, capacity_max: 2, pos_x: 200, pos_y: 80, shape: "round", zone: "Hoofdzaal" },
      { label: "3", capacity_min: 2, capacity_max: 4, pos_x: 320, pos_y: 80, shape: "square", zone: "Hoofdzaal" },
      { label: "4", capacity_min: 2, capacity_max: 4, pos_x: 80, pos_y: 220, shape: "square", zone: "Hoofdzaal" },
      { label: "5", capacity_min: 4, capacity_max: 6, pos_x: 220, pos_y: 220, shape: "rect", zone: "Hoofdzaal", width: 140 },
      { label: "6", capacity_min: 2, capacity_max: 4, pos_x: 420, pos_y: 220, shape: "square", zone: "Hoofdzaal" },
      { label: "7", capacity_min: 4, capacity_max: 6, pos_x: 80, pos_y: 360, shape: "rect", zone: "Hoofdzaal", width: 140 },
      { label: "8", capacity_min: 2, capacity_max: 2, pos_x: 280, pos_y: 360, shape: "round", zone: "Hoofdzaal" },
      // Terras
      { label: "T1", capacity_min: 2, capacity_max: 4, pos_x: 80, pos_y: 80, shape: "round", zone: "Terras" },
      { label: "T2", capacity_min: 2, capacity_max: 4, pos_x: 220, pos_y: 80, shape: "round", zone: "Terras" },
      { label: "T3", capacity_min: 4, capacity_max: 6, pos_x: 80, pos_y: 220, shape: "rect", zone: "Terras", width: 140 },
      { label: "T4", capacity_min: 2, capacity_max: 2, pos_x: 280, pos_y: 220, shape: "round", zone: "Terras" },
      // Privé
      { label: "P1", capacity_min: 6, capacity_max: 10, pos_x: 80, pos_y: 80, shape: "rect", zone: "Privé", width: 200 },
    ];
    await supabase.from("tables").insert(tables.map((t) => ({
      restaurant_id,
      zone_id: zoneMap[t.zone],
      label: t.label,
      capacity_min: t.capacity_min,
      capacity_max: t.capacity_max,
      pos_x: t.pos_x,
      pos_y: t.pos_y,
      width: t.width ?? 80,
      height: 80,
      shape: t.shape,
    })));

    // Opening hours: closed Monday, open Tue-Sun 17:00-23:00, lunch Sat-Sun 12:00-15:00
    const days = ["tue", "wed", "thu", "fri", "sat", "sun"];
    const hours: Array<Record<string, unknown>> = [];
    hours.push({ restaurant_id, weekday: "mon", open_time: "00:00", close_time: "00:00", is_closed: true });
    for (const d of days) {
      hours.push({ restaurant_id, weekday: d, open_time: "17:00", close_time: "23:00", is_closed: false });
    }
    hours.push({ restaurant_id, weekday: "sat", open_time: "12:00", close_time: "15:00", is_closed: false });
    hours.push({ restaurant_id, weekday: "sun", open_time: "12:00", close_time: "15:00", is_closed: false });
    await supabase.from("opening_hours").insert(hours);

    // Shifts
    await supabase.from("shifts").insert([
      { restaurant_id, name: "Lunch", start_time: "12:00", end_time: "15:00", weekdays: ["sat", "sun"], is_active: true },
      { restaurant_id, name: "Diner", start_time: "17:00", end_time: "22:30", weekdays: ["tue","wed","thu","fri","sat","sun"], is_active: true },
    ]);

    return json({ ok: true, seeded: true });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(p: unknown, s = 200) {
  return new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
