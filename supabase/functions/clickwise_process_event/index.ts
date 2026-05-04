// ClickWise — server-side event processor.
//
// VEILIGHEIDSPRINCIPE
// - Alle uitgaande API-calls naar ClickWise gebeuren ALLEEN hier (server-side).
// - Secrets worden uit Deno.env gelezen, NOOIT uit payloads of database.
// - Zonder geconfigureerde secrets blijft live mode geblokkeerd; events worden niet verstuurd.
// - Magic tokens en API keys worden gemaskeerd in payload previews en audit logs.
//
// Endpoints (POST):
//   { action: "readiness" }                       -> live readiness check
//   { action: "process_event", event_id: uuid }   -> verwerk één event (live indien toegestaan)
//   { action: "process_pending", limit?: number } -> verwerk batch pending events
//   { action: "test_payload", event_type, sample } -> bouw payload preview, geen externe call
//
// Geen webhook receiver hier. Webhook endpoint wordt apart en verified gebouwd.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

type Json = Record<string, unknown>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

// ClickWise server-side secrets — alleen lezen, nooit echoen.
const CLICKWISE_API_KEY = Deno.env.get("CLICKWISE_API_KEY") ?? "";
const CLICKWISE_LOCATION_ID = Deno.env.get("CLICKWISE_LOCATION_ID") ?? "";
const CLICKWISE_BASE_URL =
  Deno.env.get("CLICKWISE_BASE_URL") ?? "https://services.leadconnectorhq.com";

const SECRETS_PRESENT = Boolean(CLICKWISE_API_KEY && CLICKWISE_LOCATION_ID);

// Events die in fase 2-4 live mogen draaien zodra mapping + secrets aanwezig zijn.
const LIVE_ALLOWED_EVENTS = new Set([
  "guest.created",
  "guest.updated",
  "reservation.created",
  "reservation.updated",
  "reservation.cancelled",
  "reservation.reminder_24h_scheduled",
  "reservation.reminder_2h_scheduled",
  "reservation.reconfirmation_requested",
  "reservation.reconfirmed",
  "review.requested",
  "waitlist.notification_requested",
]);

function ok(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function fail(message: string, status = 400, extra: Json = {}) {
  return ok({ ok: false, error: message, ...extra }, status);
}

// Maskeer alle gevoelige velden in payload previews en audit data.
const SENSITIVE_KEYS = new Set([
  "magic_token", "manage_token", "cancel_token",
  "api_key", "apiKey", "authorization", "Authorization",
  "token", "access_token", "refresh_token", "secret",
]);
function maskPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskPayload);
  if (value && typeof value === "object") {
    const out: Json = {};
    for (const [k, v] of Object.entries(value as Json)) {
      out[k] = SENSITIVE_KEYS.has(k) ? "***" : maskPayload(v);
    }
    return out;
  }
  return value;
}

type Settings = {
  connection_mode: string;
  sandbox_mode: boolean;
  contact_sync_enabled: boolean;
  workflow_mapping: Record<string, { workflowName?: string; enabled?: boolean; workflowId?: string }>;
  custom_field_mapping: Record<string, { clickWise?: string; enabled?: boolean }>;
  tag_mapping: Record<string, { label?: string; enabled?: boolean; tag?: string }>;
  privacy_options: Record<string, boolean>;
  location_id: string | null;
};

async function loadSettings(admin: ReturnType<typeof createClient>, restaurantId: string) {
  const { data } = await admin
    .from("clickwise_settings").select("*").eq("restaurant_id", restaurantId).maybeSingle();
  return (data ?? null) as Settings | null;
}

function liveReadiness(settings: Settings | null) {
  const issues: string[] = [];
  if (!SECRETS_PRESENT) issues.push("ClickWise API-secrets zijn niet geconfigureerd op de server.");
  if (!settings) issues.push("Geen ClickWise instellingen gevonden.");
  if (settings && !settings.contact_sync_enabled) issues.push("Contact sync staat uit.");
  const wfMap = settings?.workflow_mapping ?? {};
  const requiredWf = [
    "reservation.created", "reservation.cancelled", "review.requested",
  ];
  const missingWf = requiredWf.filter((e) => !wfMap[e]?.enabled);
  if (missingWf.length) issues.push(`Workflow mapping ontbreekt voor: ${missingWf.join(", ")}.`);
  return {
    secrets_present: SECRETS_PRESENT,
    location_configured: Boolean(settings?.location_id || CLICKWISE_LOCATION_ID),
    issues,
    can_go_live: issues.length === 0,
    allowed_events: Array.from(LIVE_ALLOWED_EVENTS),
  };
}

async function audit(
  admin: ReturnType<typeof createClient>,
  restaurantId: string,
  action: string,
  entityId: string | null,
  data: Json,
) {
  await admin.from("audit_log").insert({
    restaurant_id: restaurantId,
    entity: "clickwise",
    entity_id: entityId,
    action,
    actor_label: "system",
    after_data: maskPayload(data) as Json,
  });
}

// Voer de daadwerkelijke ClickWise API call uit. Retourneert {ok, status, body}.
// Houd dit minimaal en defensief — in deze fase voornamelijk workflow trigger payload.
async function callClickWise(path: string, body: Json) {
  if (!SECRETS_PRESENT) {
    return { ok: false, status: 0, body: { error: "secrets_missing" } as Json };
  }
  const url = `${CLICKWISE_BASE_URL.replace(/\/$/, "")}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLICKWISE_API_KEY}`,
        "Content-Type": "application/json",
        "Version": "2021-07-28",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: Json = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text.slice(0, 500) }; }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (e) {
    return { ok: false, status: 0, body: { error: e instanceof Error ? e.message : "network_error" } };
  }
}

type EventRow = {
  id: string;
  restaurant_id: string;
  event_type: string;
  payload: Json;
  status: string;
  attempts: number;
  retry_count: number;
  metadata: Json;
};

async function processEvent(
  admin: ReturnType<typeof createClient>,
  ev: EventRow,
  settings: Settings | null,
  liveAllowed: boolean,
) {
  const masked = maskPayload(ev.payload) as Json;

  // Idempotency: al verwerkt → niet opnieuw versturen zonder expliciete retry.
  if (ev.status === "sent") {
    return { ok: true, skipped: true, reason: "already_processed" };
  }

  // Workflow mapping check
  const wf = settings?.workflow_mapping?.[ev.event_type];
  const wfEnabled = Boolean(wf?.enabled);
  const wfId = (wf?.workflowId as string | undefined) ?? "";

  // Test/prepared mode → alleen markeren als verwerkt-test, geen externe call.
  if (!liveAllowed || !LIVE_ALLOWED_EVENTS.has(ev.event_type)) {
    await admin.from("integration_events").update({
      status: "skipped",
      processed_at: new Date().toISOString(),
      last_error: !liveAllowed
        ? "Live mode niet actief — payload alleen voorbereid."
        : "Event type nog niet vrijgegeven voor live verzending.",
      metadata: { ...(ev.metadata || {}), preview: masked, mode: "test" },
    }).eq("id", ev.id);
    await audit(admin, ev.restaurant_id, "clickwise.event_skipped", ev.id, {
      event_type: ev.event_type, reason: "test_mode_or_event_not_live",
    });
    return { ok: true, skipped: true, reason: "test_mode_or_event_gated" };
  }

  if (!wfEnabled || !wfId) {
    await admin.from("integration_events").update({
      status: "failed",
      last_error: "Geen ClickWise workflow gekoppeld aan dit eventtype.",
      attempts: (ev.attempts || 0) + 1,
    }).eq("id", ev.id);
    await audit(admin, ev.restaurant_id, "clickwise.event_failed", ev.id, {
      event_type: ev.event_type, reason: "workflow_mapping_missing",
    });
    return { ok: false, error: "workflow_mapping_missing" };
  }

  // Mark processing
  await admin.from("integration_events").update({
    status: "processing", attempts: (ev.attempts || 0) + 1,
  }).eq("id", ev.id);

  // Call: workflow trigger pattern (HighLevel: POST /workflows/{id}/trigger)
  const locationId = settings?.location_id || CLICKWISE_LOCATION_ID;
  const result = await callClickWise(`/workflows/${wfId}/trigger`, {
    locationId,
    contactId: (ev.payload?.clickwise_contact_id as string | undefined) ?? null,
    payload: ev.payload,
  });

  if (result.ok) {
    await admin.from("integration_events").update({
      status: "sent",
      processed_at: new Date().toISOString(),
      last_error: null,
      metadata: { ...(ev.metadata || {}), response: result.body, http_status: result.status },
    }).eq("id", ev.id);
    await audit(admin, ev.restaurant_id, "clickwise.workflow_triggered", ev.id, {
      event_type: ev.event_type, http_status: result.status,
    });
    return { ok: true };
  }

  await admin.from("integration_events").update({
    status: "failed",
    last_error: `ClickWise API fout (${result.status}): ${JSON.stringify(result.body).slice(0, 200)}`,
  }).eq("id", ev.id);
  await audit(admin, ev.restaurant_id, "clickwise.event_failed", ev.id, {
    event_type: ev.event_type, http_status: result.status,
  });
  return { ok: false, status: result.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: alleen ingelogde members van het restaurant mogen processor aanroepen.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return fail("unauthorized", 401);

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (claimsErr || !claims?.claims?.sub) return fail("unauthorized", 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: Json = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const action = (body.action as string) || "readiness";

  try {
    if (action === "readiness") {
      const restaurantId = body.restaurant_id as string;
      if (!restaurantId) return fail("restaurant_id required");
      // Authorize member
      const { data: m } = await userClient
        .from("restaurant_members").select("id").eq("restaurant_id", restaurantId).maybeSingle();
      if (!m) return fail("forbidden", 403);
      const settings = await loadSettings(admin, restaurantId);
      return ok({ ok: true, ...liveReadiness(settings) });
    }

    if (action === "test_payload") {
      // Geen externe call — pure preview, gemaskeerd.
      const eventType = body.event_type as string;
      const sample = (body.sample as Json) ?? {};
      return ok({
        ok: true, event_type: eventType,
        payload_preview: maskPayload({ event_type: eventType, ...sample }),
        live_secrets_present: SECRETS_PRESENT,
      });
    }

    if (action === "process_event") {
      const eventId = body.event_id as string;
      if (!eventId) return fail("event_id required");
      const { data: ev } = await admin
        .from("integration_events").select("*").eq("id", eventId).maybeSingle();
      if (!ev) return fail("event_not_found", 404);
      // member check
      const { data: m } = await userClient
        .from("restaurant_members").select("id, role")
        .eq("restaurant_id", (ev as EventRow).restaurant_id).maybeSingle();
      if (!m) return fail("forbidden", 403);
      const settings = await loadSettings(admin, (ev as EventRow).restaurant_id);
      const liveAllowed = settings?.connection_mode === "live" && SECRETS_PRESENT;
      const r = await processEvent(admin, ev as EventRow, settings, liveAllowed);
      return ok({ ok: true, result: r, live_mode: liveAllowed });
    }

    if (action === "process_pending") {
      const restaurantId = body.restaurant_id as string;
      const limit = Math.min(Number(body.limit ?? 10), 25);
      if (!restaurantId) return fail("restaurant_id required");
      const { data: m } = await userClient
        .from("restaurant_members").select("id, role").eq("restaurant_id", restaurantId).maybeSingle();
      if (!m || !["owner", "manager"].includes((m as { role: string }).role)) return fail("forbidden", 403);
      const settings = await loadSettings(admin, restaurantId);
      const liveAllowed = settings?.connection_mode === "live" && SECRETS_PRESENT;
      const { data: rows } = await admin
        .from("integration_events").select("*")
        .eq("restaurant_id", restaurantId).eq("status", "pending")
        .order("created_at", { ascending: true }).limit(limit);
      const results: Json[] = [];
      for (const row of (rows ?? []) as EventRow[]) {
        results.push({ id: row.id, event_type: row.event_type, ...(await processEvent(admin, row, settings, liveAllowed)) });
      }
      return ok({ ok: true, processed: results.length, live_mode: liveAllowed, results });
    }

    return fail("unknown_action");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    return fail(msg, 500);
  }
});
