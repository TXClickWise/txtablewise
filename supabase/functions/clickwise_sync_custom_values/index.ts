// ClickWise — Route 1: Custom Values push naar bestaand sub-account.
//
// Idempotent. Doet ALLEEN Custom Values upsert. Raakt geen native velden.
// POST: { restaurant_id, agent_api_key?, dry_run? }. Auth: system admin OR manager.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { buildCustomValues, makeHlFetch, upsertCustomValues } from "../_shared/clickwise-hl.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const HL_API_KEY = Deno.env.get("HIGHLEVEL_AGENCY_API_KEY") ?? Deno.env.get("CLICKWISE_API_KEY") ?? "";
const HL_BASE = Deno.env.get("CLICKWISE_BASE_URL") ?? "https://services.leadconnectorhq.com";
const TABLEWISE_BASE_URL = `${SUPABASE_URL}/functions/v1`;

type Json = Record<string, unknown>;
const ok = (b: Json, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fail = (msg: string, s = 400, extra: Json = {}) => ok({ ok: false, error: msg, ...extra }, s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return fail("unauthorized", 401);

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return fail("unauthorized", 401);

  let body: { restaurant_id?: string; agent_api_key?: string; dry_run?: boolean } = {};
  try { body = await req.json(); } catch { return fail("invalid_json"); }
  const restaurantId = body.restaurant_id;
  if (!restaurantId) return fail("restaurant_id_required");

  const { data: isAdmin } = await userClient.rpc("is_system_admin");
  const { data: isMgr } = await userClient.rpc("is_restaurant_manager", { _restaurant_id: restaurantId });
  if (!isAdmin && !isMgr) return fail("forbidden", 403);

  if (!HL_API_KEY) return fail("hl_api_key_missing", 500);

  const { data: settings } = await admin
    .from("clickwise_settings").select("*").eq("restaurant_id", restaurantId).maybeSingle();
  if (!settings) return fail("clickwise_settings_not_found", 404);
  const locationId = (settings as any).location_id as string | null;
  if (!locationId) return fail("location_id_not_configured", 400);

  const { data: r } = await admin
    .from("restaurants").select("webhook_secret, name, timezone").eq("id", restaurantId).maybeSingle();

  const values = buildCustomValues({
    restaurantId,
    webhookSecret: (r as any)?.webhook_secret ?? null,
    apiKey: body.agent_api_key ?? null,
    tablewiseBaseUrl: TABLEWISE_BASE_URL,
    restaurantName: (r as any)?.name ?? null,
    timezone: (r as any)?.timezone ?? null,
    anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? null,
  });

  if (body.dry_run) return ok({ ok: true, dry_run: true, values, location_id: locationId });

  const hl = makeHlFetch(HL_API_KEY, HL_BASE);
  const result = await upsertCustomValues(hl, locationId, values);
  if (!result.ok) {
    await admin.from("audit_log").insert({
      restaurant_id: restaurantId, entity: "clickwise", action: "custom_values.sync_failed",
      actor_label: "system", after_data: { error: result, keys: Object.keys(values) } as Json,
    });
    return fail("sync_failed", 502, { detail: result });
  }

  await admin.from("clickwise_settings").update({ synced_at: new Date().toISOString() }).eq("restaurant_id", restaurantId);
  await admin.from("audit_log").insert({
    restaurant_id: restaurantId, entity: "clickwise", action: "custom_values.synced",
    actor_label: "system", after_data: { keys: Object.keys(values), results: result.results } as Json,
  });

  return ok({ ok: true, synced_keys: Object.keys(values), results: result.results });
});
