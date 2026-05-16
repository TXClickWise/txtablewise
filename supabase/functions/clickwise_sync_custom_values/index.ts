// ClickWise — Route 1: Custom Values push naar bestaand sub-account.
//
// Idempotent. Doet ALLEEN Custom Values (PUT/UPSERT per key).
// Raakt geen native sub-account velden (naam, adres, telefoon).
// Wordt ook hergebruikt door clickwise_provision_subaccount.
//
// POST body:
//   { restaurant_id: uuid, agent_api_key?: string (plaintext, optioneel), dry_run?: boolean }
//
// Auth: system admin OR restaurant manager.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const HL_API_KEY =
  Deno.env.get("HIGHLEVEL_AGENCY_API_KEY") ??
  Deno.env.get("CLICKWISE_API_KEY") ??
  "";
const HL_BASE = (Deno.env.get("CLICKWISE_BASE_URL") ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
const TABLEWISE_BASE_URL = `${SUPABASE_URL}/functions/v1`;

type Json = Record<string, unknown>;

function ok(b: Json, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function fail(msg: string, s = 400, extra: Json = {}) { return ok({ ok: false, error: msg, ...extra }, s); }

async function hlFetch(path: string, method: string, body?: Json) {
  const res = await fetch(`${HL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${HL_API_KEY}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: Json = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text.slice(0, 500) }; }
  return { ok: res.ok, status: res.status, body: parsed };
}

// Build de canonical set Custom Values voor TableWise → ClickWise snapshot.
export function buildCustomValues(args: {
  restaurantId: string;
  webhookSecret: string | null;
  apiKey: string | null;
  tablewiseBaseUrl: string;
}) {
  const cv: Record<string, string> = {
    tablewise_base_url: args.tablewiseBaseUrl,
    tablewise_restaurant_id: args.restaurantId,
  };
  if (args.webhookSecret) cv.tablewise_webhook_secret = args.webhookSecret;
  if (args.apiKey) cv.tablewise_api_key = args.apiKey;
  return cv;
}

// PUT/UPSERT custom values via HighLevel API.
// HL endpoint: GET /locations/{locationId}/customValues -> list. POST creates, PUT /{id} updates.
async function upsertCustomValues(locationId: string, values: Record<string, string>) {
  // 1. list existing
  const list = await hlFetch(`/locations/${locationId}/customValues`, "GET");
  if (!list.ok) return { ok: false, error: "list_failed", status: list.status, body: list.body };
  const existing: Array<{ id: string; name?: string; fieldKey?: string; key?: string }> =
    (list.body as any)?.customValues ?? [];
  const byKey = new Map<string, { id: string }>();
  for (const cv of existing) {
    const k = cv.fieldKey ?? cv.key ?? cv.name;
    if (k) byKey.set(k.replace(/^custom_values\./, ""), { id: cv.id });
  }

  const results: Array<{ key: string; action: string; status: number }> = [];
  for (const [key, value] of Object.entries(values)) {
    const found = byKey.get(key);
    if (found) {
      const r = await hlFetch(`/locations/${locationId}/customValues/${found.id}`, "PUT", { name: key, value });
      results.push({ key, action: "update", status: r.status });
      if (!r.ok) return { ok: false, error: "update_failed", key, status: r.status, body: r.body, results };
    } else {
      const r = await hlFetch(`/locations/${locationId}/customValues`, "POST", { name: key, value });
      results.push({ key, action: "create", status: r.status });
      if (!r.ok) return { ok: false, error: "create_failed", key, status: r.status, body: r.body, results };
    }
  }
  return { ok: true, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return fail("unauthorized", 401);

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) return fail("unauthorized", 401);

  let body: { restaurant_id?: string; agent_api_key?: string; dry_run?: boolean } = {};
  try { body = await req.json(); } catch { return fail("invalid_json"); }
  const restaurantId = body.restaurant_id;
  if (!restaurantId) return fail("restaurant_id_required");

  // Authorize: system_admin or restaurant manager
  const { data: isAdmin } = await admin.rpc("is_system_admin");
  const { data: isMgr } = await userClient.rpc("is_restaurant_manager", { _restaurant_id: restaurantId });
  if (!isAdmin && !isMgr) return fail("forbidden", 403);

  if (!HL_API_KEY) return fail("hl_api_key_missing", 500);

  // Load settings + restaurant
  const { data: settings } = await admin
    .from("clickwise_settings").select("*").eq("restaurant_id", restaurantId).maybeSingle();
  if (!settings) return fail("clickwise_settings_not_found", 404);
  const locationId = (settings as any).location_id as string | null;
  if (!locationId) return fail("location_id_not_configured", 400);

  const { data: r } = await admin
    .from("restaurants").select("webhook_secret, name").eq("id", restaurantId).maybeSingle();

  const values = buildCustomValues({
    restaurantId,
    webhookSecret: (r as any)?.webhook_secret ?? null,
    apiKey: body.agent_api_key ?? null,
    tablewiseBaseUrl: TABLEWISE_BASE_URL,
  });

  if (body.dry_run) return ok({ ok: true, dry_run: true, values, location_id: locationId });

  const result = await upsertCustomValues(locationId, values);
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
