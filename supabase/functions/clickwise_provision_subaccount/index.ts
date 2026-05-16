// ClickWise — Route 2: nieuw sub-account aanmaken vanuit TableWise via SaaS-plan.
//
// Flow:
//  1. validate add-on `active` + pre-flight fields
//  2. POST /locations/ met saasPlanId -> snapshot komt automatisch mee
//  3. wait ~6s zodat workflows/templates klaar staan
//  4. push Custom Values via dezelfde logic als clickwise_sync_custom_values
//  5. update clickwise_settings (location_id, provisioned_at, saas_plan_id, status)
//  6. audit-log + rollback bij failure
//
// POST body: { restaurant_id: uuid, agent_api_key?: string, dry_run?: boolean }
// Auth: system admin only (pilot fase).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { buildCustomValues } from "../clickwise_sync_custom_values/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const HL_API_KEY = Deno.env.get("HIGHLEVEL_AGENCY_API_KEY") ?? Deno.env.get("CLICKWISE_API_KEY") ?? "";
const HL_COMPANY_ID = Deno.env.get("HIGHLEVEL_COMPANY_ID") ?? "";
const HL_SAAS_PLAN_ID = Deno.env.get("HIGHLEVEL_SAAS_PLAN_ID") ?? "";
const HL_BASE = (Deno.env.get("CLICKWISE_BASE_URL") ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
const TABLEWISE_BASE_URL = `${SUPABASE_URL}/functions/v1`;

type Json = Record<string, unknown>;
const ok = (b: Json, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fail = (msg: string, s = 400, extra: Json = {}) => ok({ ok: false, error: msg, ...extra }, s);

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

async function upsertCustomValues(locationId: string, values: Record<string, string>) {
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
    const r = found
      ? await hlFetch(`/locations/${locationId}/customValues/${found.id}`, "PUT", { name: key, value })
      : await hlFetch(`/locations/${locationId}/customValues`, "POST", { name: key, value });
    results.push({ key, action: found ? "update" : "create", status: r.status });
    if (!r.ok) return { ok: false, error: "upsert_failed", key, status: r.status, body: r.body, results };
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
  if (!userRes?.user) return fail("unauthorized", 401);

  const { data: isAdmin } = await userClient.rpc("is_system_admin");
  if (!isAdmin) return fail("system_admin_only", 403);

  let body: { restaurant_id?: string; agent_api_key?: string; dry_run?: boolean } = {};
  try { body = await req.json(); } catch { return fail("invalid_json"); }
  const restaurantId = body.restaurant_id;
  if (!restaurantId) return fail("restaurant_id_required");

  if (!HL_API_KEY || !HL_COMPANY_ID || !HL_SAAS_PLAN_ID) {
    return fail("hl_secrets_missing", 500, {
      hint: "Set HIGHLEVEL_AGENCY_API_KEY (or CLICKWISE_API_KEY), HIGHLEVEL_COMPANY_ID, HIGHLEVEL_SAAS_PLAN_ID.",
    });
  }

  // Load restaurant + settings
  const { data: r } = await admin.from("restaurants").select("*").eq("id", restaurantId).maybeSingle();
  if (!r) return fail("restaurant_not_found", 404);

  const { data: settings } = await admin
    .from("clickwise_settings").select("*").eq("restaurant_id", restaurantId).maybeSingle();
  if (settings && (settings as any).location_id) {
    return fail("already_provisioned", 409, { location_id: (settings as any).location_id });
  }
  if (settings && (settings as any).clickwise_addon !== "active") {
    return fail("addon_not_active", 402, { addon: (settings as any).clickwise_addon });
  }

  // Pre-flight
  const missing: string[] = [];
  for (const f of ["name", "email", "phone", "address_line1", "postal_code", "city", "country", "timezone"]) {
    if (!(r as any)[f]) missing.push(f);
  }
  if (missing.length) return fail("preflight_missing_fields", 400, { missing });

  // Rate-limit: 1 attempt per hour per restaurant
  const lastAttempt = settings ? (settings as any).last_provision_attempt_at : null;
  if (lastAttempt && Date.now() - new Date(lastAttempt).getTime() < 60 * 60 * 1000) {
    return fail("rate_limited", 429, { last_attempt: lastAttempt });
  }

  const locationPayload: Json = {
    name: r.name,
    companyId: HL_COMPANY_ID,
    address: r.address_line1,
    city: r.city,
    postalCode: r.postal_code,
    country: r.country,
    timezone: r.timezone,
    email: r.email,
    phone: r.phone,
    website: r.website ?? undefined,
    saasPlanId: HL_SAAS_PLAN_ID,
  };

  if (body.dry_run) {
    return ok({
      ok: true, dry_run: true, location_payload: locationPayload,
      custom_values: buildCustomValues({
        restaurantId, webhookSecret: r.webhook_secret ?? null,
        apiKey: body.agent_api_key ?? null, tablewiseBaseUrl: TABLEWISE_BASE_URL,
      }),
    });
  }

  // Mark provisioning
  await admin.from("clickwise_settings").upsert({
    restaurant_id: restaurantId,
    provisioning_status: "provisioning",
    last_provision_attempt_at: new Date().toISOString(),
  }, { onConflict: "restaurant_id" });

  // 1. Create location
  const create = await hlFetch("/locations/", "POST", locationPayload);
  if (!create.ok) {
    await admin.from("clickwise_settings").update({
      provisioning_status: "failed",
      provisioning_error: `create_location: HTTP ${create.status} ${JSON.stringify(create.body).slice(0, 300)}`,
    }).eq("restaurant_id", restaurantId);
    await admin.from("audit_log").insert({
      restaurant_id: restaurantId, entity: "clickwise", action: "subaccount.create_failed",
      actor_label: "system", after_data: { status: create.status, body: create.body } as Json,
    });
    return fail("create_location_failed", 502, { detail: create });
  }
  const newLocationId: string | undefined = (create.body as any)?.id ?? (create.body as any)?.location?.id;
  if (!newLocationId) {
    return fail("create_location_no_id", 502, { body: create.body });
  }

  // 2. Wait for snapshot load
  await new Promise((res) => setTimeout(res, 6000));

  // 3. Push Custom Values
  const values = buildCustomValues({
    restaurantId,
    webhookSecret: r.webhook_secret ?? null,
    apiKey: body.agent_api_key ?? null,
    tablewiseBaseUrl: TABLEWISE_BASE_URL,
  });
  const cvResult = await upsertCustomValues(newLocationId, values);
  if (!cvResult.ok) {
    // Rollback
    const del = await hlFetch(`/locations/${newLocationId}`, "DELETE");
    await admin.from("clickwise_settings").update({
      provisioning_status: "failed",
      provisioning_error: `custom_values: ${JSON.stringify(cvResult).slice(0, 300)}; rollback HTTP ${del.status}`,
    }).eq("restaurant_id", restaurantId);
    await admin.from("audit_log").insert({
      restaurant_id: restaurantId, entity: "clickwise", action: "subaccount.cv_failed_rollback",
      actor_label: "system", after_data: { location_id: newLocationId, cv: cvResult, rollback_status: del.status } as Json,
    });
    return fail("custom_values_failed_rolled_back", 502, { detail: cvResult });
  }

  // 4. Persist
  await admin.from("clickwise_settings").update({
    location_id: newLocationId,
    saas_plan_id: HL_SAAS_PLAN_ID,
    provisioning_status: "provisioned",
    provisioning_error: null,
    provisioned_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }).eq("restaurant_id", restaurantId);

  await admin.from("audit_log").insert({
    restaurant_id: restaurantId, entity: "clickwise", action: "subaccount.provisioned",
    actor_label: "system",
    after_data: { location_id: newLocationId, saas_plan_id: HL_SAAS_PLAN_ID, synced_keys: Object.keys(values) } as Json,
  });

  return ok({
    ok: true,
    location_id: newLocationId,
    saas_plan_id: HL_SAAS_PLAN_ID,
    synced_keys: Object.keys(values),
    next_steps: [
      "Koop LC-Phone nummer in HighLevel sub-account",
      "Dien Twilio Regulatory Bundle in (NL)",
      "Koppel nummer aan Voice AI assistant",
    ],
  });
});
