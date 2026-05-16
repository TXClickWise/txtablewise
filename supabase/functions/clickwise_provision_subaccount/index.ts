// ClickWise — Route 2: nieuw sub-account aanmaken via SaaS-plan.
// Snapshot komt automatisch mee via plan. Daarna Custom Values pushen.
// POST: { restaurant_id, agent_api_key?, dry_run? }. Auth: system admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { buildCustomValues, makeHlFetch, upsertCustomValues } from "../_shared/clickwise-hl.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const HL_API_KEY = Deno.env.get("HIGHLEVEL_AGENCY_API_KEY") ?? Deno.env.get("CLICKWISE_API_KEY") ?? "";
const HL_COMPANY_ID = Deno.env.get("HIGHLEVEL_COMPANY_ID") ?? "";
const HL_SAAS_PLAN_ID = Deno.env.get("HIGHLEVEL_SAAS_PLAN_ID") ?? "";
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

  const missing: string[] = [];
  for (const f of ["name", "email", "phone", "address_line1", "postal_code", "city", "country", "timezone"]) {
    if (!(r as any)[f]) missing.push(f);
  }
  if (missing.length) return fail("preflight_missing_fields", 400, { missing });

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

  const cvPreview = buildCustomValues({
    restaurantId, webhookSecret: r.webhook_secret ?? null,
    apiKey: body.agent_api_key ?? null, tablewiseBaseUrl: TABLEWISE_BASE_URL,
  });

  if (body.dry_run) {
    return ok({ ok: true, dry_run: true, location_payload: locationPayload, custom_values: cvPreview });
  }

  await admin.from("clickwise_settings").upsert({
    restaurant_id: restaurantId,
    provisioning_status: "provisioning",
    last_provision_attempt_at: new Date().toISOString(),
  }, { onConflict: "restaurant_id" });

  const hl = makeHlFetch(HL_API_KEY, HL_BASE);

  const create = await hl("/locations/", "POST", locationPayload);
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
  const newLocationId: string | undefined =
    (create.body as any)?.id ?? (create.body as any)?.location?.id ?? (create.body as any)?._id;
  if (!newLocationId) return fail("create_location_no_id", 502, { body: create.body });

  await new Promise((res) => setTimeout(res, 6000));

  const cvResult = await upsertCustomValues(hl, newLocationId, cvPreview);
  if (!cvResult.ok) {
    const del = await hl(`/locations/${newLocationId}`, "DELETE");
    await admin.from("clickwise_settings").update({
      provisioning_status: "failed",
      provisioning_error: `custom_values: ${JSON.stringify(cvResult).slice(0, 300)}; rollback HTTP ${del.status}`,
    }).eq("restaurant_id", restaurantId);
    await admin.from("audit_log").insert({
      restaurant_id: restaurantId, entity: "clickwise", action: "subaccount.cv_failed_rollback",
      actor_label: "system",
      after_data: { location_id: newLocationId, cv: cvResult, rollback_status: del.status } as Json,
    });
    return fail("custom_values_failed_rolled_back", 502, { detail: cvResult });
  }

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
    after_data: { location_id: newLocationId, saas_plan_id: HL_SAAS_PLAN_ID, synced_keys: Object.keys(cvPreview) } as Json,
  });

  return ok({
    ok: true, location_id: newLocationId, saas_plan_id: HL_SAAS_PLAN_ID,
    synced_keys: Object.keys(cvPreview),
    next_steps: [
      "Koop LC-Phone nummer in HighLevel sub-account",
      "Dien Twilio Regulatory Bundle in (NL)",
      "Koppel nummer aan Voice AI assistant",
    ],
  });
});
