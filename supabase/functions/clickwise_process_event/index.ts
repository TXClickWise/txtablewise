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
async function callClickWise(path: string, body: Json, method: "POST" | "PUT" | "GET" = "POST") {
  if (!SECRETS_PRESENT) {
    return { ok: false, status: 0, body: { error: "secrets_missing" } as Json };
  }
  const url = `${CLICKWISE_BASE_URL.replace(/\/$/, "")}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${CLICKWISE_API_KEY}`,
        "Content-Type": "application/json",
        "Version": "2021-07-28",
        "Accept": "application/json",
      },
      body: method === "GET" ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: Json = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text.slice(0, 500) }; }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (e) {
    return { ok: false, status: 0, body: { error: e instanceof Error ? e.message : "network_error" } };
  }
}

// ---------- Contact / fields / tags helpers ----------

type GuestRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  allergies: string | null;
  dietary_preferences: string | null;
  seating_preferences: string | null;
  hospitality_notes: string | null;
  marketing_consent: boolean | null;
  is_vip: boolean | null;
  visit_count: number | null;
  no_show_count: number | null;
  preferred_channel: string | null;
  source_channel: string | null;
  last_visit_at: string | null;
  clickwise_contact_id: string | null;
};

function priv(settings: Settings | null, key: string, defaultValue = false): boolean {
  const v = settings?.privacy_options?.[key];
  return typeof v === "boolean" ? v : defaultValue;
}

function buildCustomFields(
  settings: Settings | null,
  guest: GuestRow,
  reservationContext: Json | null,
): Array<{ key: string; field_value: unknown }> {
  const map = settings?.custom_field_mapping ?? {};
  const out: Array<{ key: string; field_value: unknown }> = [];

  const allowAllergies = priv(settings, "share_allergies", true);
  const allowVisitCount = priv(settings, "share_visit_count", true);
  const allowNoShow = priv(settings, "share_no_show_count", true);
  const allowHospitality = priv(settings, "share_hospitality_notes", false);

  const guestValues: Record<string, unknown> = {
    visit_count: allowVisitCount ? (guest.visit_count ?? 0) : undefined,
    no_show_count: allowNoShow ? (guest.no_show_count ?? 0) : undefined,
    preferred_channel: guest.preferred_channel ?? undefined,
    preferred_language: guest.language ?? undefined,
    seating_preferences: allowHospitality ? guest.seating_preferences ?? undefined : undefined,
    allergies: allowAllergies ? guest.allergies ?? undefined : undefined,
    dietary_preferences: allowAllergies ? guest.dietary_preferences ?? undefined : undefined,
    marketing_opt_in: guest.marketing_consent === true ? "true" : guest.marketing_consent === false ? "false" : undefined,
    is_vip: guest.is_vip ? "true" : "false",
    last_visit_at: guest.last_visit_at ?? undefined,
    source_channel: guest.source_channel ?? undefined,
  };

  const ctx = (reservationContext ?? {}) as Record<string, unknown>;
  const reservationValues: Record<string, unknown> = {
    next_reservation_date: ctx.reservation_date ?? ctx.date,
    next_reservation_time: ctx.start_time_local ?? ctx.time,
    next_reservation_party_size: ctx.party_size,
    next_reservation_status: ctx.status,
    next_reservation_source: ctx.source_channel ?? ctx.channel,
    next_reservation_zone: ctx.zone,
    next_reservation_special_occasion: ctx.occasion,
    next_reservation_pre_orders: ctx.pre_orders,
  };

  const all: Record<string, unknown> = { ...guestValues, ...reservationValues };
  for (const [tableWiseKey, def] of Object.entries(map)) {
    if (!def?.enabled) continue;
    const cwKey = def.clickWise ?? tableWiseKey;
    const value = all[tableWiseKey];
    if (value === undefined || value === null || value === "") continue;
    out.push({ key: cwKey, field_value: value });
  }
  return out;
}

function buildTags(settings: Settings | null, guest: GuestRow, ctx: Json | null): string[] {
  const map = settings?.tag_mapping ?? {};
  const tags: string[] = [];
  const allowMarketing = guest.marketing_consent === true;
  const channel = (ctx as Record<string, unknown> | null)?.channel as string | undefined;

  const rules: Record<string, boolean> = {
    vip_guest: !!guest.is_vip,
    returning_guest: (guest.visit_count ?? 0) > 1,
    allergy: !!(guest.allergies && guest.allergies.trim()),
    dietary_preference: !!(guest.dietary_preferences && guest.dietary_preferences.trim()),
    no_show_history: (guest.no_show_count ?? 0) > 0,
    walk_in_guest: channel === "walk_in",
    marketing_opt_in: allowMarketing,
    high_no_show_attention: (guest.no_show_count ?? 0) >= 2,
  };

  for (const [key, def] of Object.entries(map)) {
    if (!def?.enabled) continue;
    if (!rules[key]) continue;
    if (def.tag) tags.push(def.tag);
  }
  return tags;
}

async function upsertContact(
  admin: ReturnType<typeof createClient>,
  settings: Settings | null,
  guest: GuestRow,
  ctx: Json | null,
): Promise<{ ok: boolean; contact_id?: string; status?: number; body?: Json }> {
  const locationId = settings?.location_id || CLICKWISE_LOCATION_ID;
  if (!locationId) return { ok: false, body: { error: "location_missing" } };

  const customFields = buildCustomFields(settings, guest, ctx);
  const tags = buildTags(settings, guest, ctx);

  const basePayload: Json = {
    locationId,
    firstName: guest.first_name ?? "",
    lastName: guest.last_name ?? "",
    email: guest.email ?? undefined,
    phone: guest.phone ?? undefined,
    tags,
    customFields,
  };

  if (guest.clickwise_contact_id) {
    const r = await callClickWise(`/contacts/${guest.clickwise_contact_id}`, basePayload, "PUT");
    if (r.ok) return { ok: true, contact_id: guest.clickwise_contact_id, status: r.status, body: r.body };
  }

  const tryParams: string[] = [];
  if (guest.phone) tryParams.push(`number=${encodeURIComponent(guest.phone)}`);
  if (guest.email) tryParams.push(`email=${encodeURIComponent(guest.email)}`);
  let foundId: string | null = null;
  for (const param of tryParams) {
    const search = await callClickWise(
      `/contacts/search/duplicate?locationId=${encodeURIComponent(locationId)}&${param}`,
      {}, "GET",
    );
    if (search.ok) {
      const c = (search.body as Record<string, unknown>)?.contact as Record<string, unknown> | undefined;
      const id = (c?.id as string | undefined) ?? ((search.body as Record<string, unknown>)?.id as string | undefined);
      if (id) { foundId = id; break; }
    }
  }

  if (foundId) {
    const r = await callClickWise(`/contacts/${foundId}`, basePayload, "PUT");
    if (r.ok) {
      await admin.from("guests").update({ clickwise_contact_id: foundId }).eq("id", guest.id);
      return { ok: true, contact_id: foundId, status: r.status, body: r.body };
    }
    return { ok: false, status: r.status, body: r.body };
  }

  const created = await callClickWise(`/contacts/`, basePayload, "POST");
  if (created.ok) {
    const c = (created.body as Record<string, unknown>)?.contact as Record<string, unknown> | undefined;
    const id = (c?.id as string | undefined) ?? ((created.body as Record<string, unknown>)?.id as string | undefined);
    if (id) {
      await admin.from("guests").update({ clickwise_contact_id: id }).eq("id", guest.id);
      return { ok: true, contact_id: id, status: created.status, body: created.body };
    }
  }
  return { ok: false, status: created.status, body: created.body };
}

async function loadGuestForEvent(
  admin: ReturnType<typeof createClient>,
  ev: EventRow,
): Promise<GuestRow | null> {
  const guestId =
    (ev.payload?.guest_id as string | undefined) ??
    ((ev.payload?.guest as Record<string, unknown> | undefined)?.id as string | undefined);
  if (!guestId) return null;
  const { data } = await admin.from("guests").select(
    "id, first_name, last_name, email, phone, language, allergies, dietary_preferences, seating_preferences, hospitality_notes, marketing_consent, is_vip, visit_count, no_show_count, preferred_channel, source_channel, last_visit_at, clickwise_contact_id",
  ).eq("id", guestId).maybeSingle();
  return (data ?? null) as GuestRow | null;
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

  // Mark processing early
  await admin.from("integration_events").update({
    status: "processing", attempts: (ev.attempts || 0) + 1,
  }).eq("id", ev.id);

  // Optional contact upsert. Voor guest.* en reservation.* events met guest_id.
  let contactId: string | null = (ev.payload?.clickwise_contact_id as string | undefined) ?? null;
  let contactUpsertResult: Json | null = null;
  if (settings?.contact_sync_enabled) {
    const isGuestEvent = ev.event_type.startsWith("guest.");
    const isReservationEvent = ev.event_type.startsWith("reservation.");
    if (isGuestEvent || isReservationEvent) {
      const guest = await loadGuestForEvent(admin, ev);
      if (guest) {
        const r = await upsertContact(admin, settings, guest, ev.payload);
        contactUpsertResult = { ok: r.ok, status: r.status ?? null, contact_id: r.contact_id ?? null };
        if (r.ok && r.contact_id) contactId = r.contact_id;
        if (!r.ok && isGuestEvent) {
          // Voor pure guest events is upsert het hele doel — markeer als failed.
          await admin.from("integration_events").update({
            status: "failed",
            last_error: `Contact upsert mislukt (${r.status ?? 0}): ${JSON.stringify(r.body ?? {}).slice(0, 200)}`,
            metadata: { ...(ev.metadata || {}), contact_upsert: contactUpsertResult, mode: "live" },
          }).eq("id", ev.id);
          await audit(admin, ev.restaurant_id, "clickwise.contact_upsert_failed", ev.id, { event_type: ev.event_type, status: r.status });
          return { ok: false, error: "contact_upsert_failed", status: r.status };
        }
      }
    }
  }

  // Pure contact-sync events (guest.created/updated zonder workflow) → markeer sent na upsert.
  if (ev.event_type === "guest.created" || ev.event_type === "guest.updated") {
    if (!wfEnabled || !wfId) {
      await admin.from("integration_events").update({
        status: "sent",
        processed_at: new Date().toISOString(),
        last_error: null,
        metadata: { ...(ev.metadata || {}), contact_upsert: contactUpsertResult, mode: "live" },
      }).eq("id", ev.id);
      await audit(admin, ev.restaurant_id, "clickwise.contact_synced", ev.id, { event_type: ev.event_type, contact_id: contactId });
      return { ok: true, contact_id: contactId };
    }
  }

  if (!wfEnabled || !wfId) {
    await admin.from("integration_events").update({
      status: "failed",
      last_error: "Geen ClickWise workflow gekoppeld aan dit eventtype.",
    }).eq("id", ev.id);
    await audit(admin, ev.restaurant_id, "clickwise.event_failed", ev.id, {
      event_type: ev.event_type, reason: "workflow_mapping_missing",
    });
    return { ok: false, error: "workflow_mapping_missing" };
  }

  // Resolve guest locale centrally so ALL outgoing ClickWise events
  // (reminders, confirmations, reconfirmations, reviews, waitlist, …) carry
  // the right language. Priority: reservations.guest_language →
  // guests.language → restaurants.default_locale → 'nl'.
  const SUPPORTED_LOCALES = new Set(["nl", "en", "de", "fr"]);
  const normalizeLocale = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const short = v.toLowerCase().slice(0, 2);
    return SUPPORTED_LOCALES.has(short) ? short : null;
  };
  let resolvedLocale: string | null = normalizeLocale((ev.payload as Record<string, unknown>)?.locale);
  let localeSource = resolvedLocale ? "payload" : "fallback";
  const reservationId = (ev.payload?.reservation_id as string | undefined)
    ?? (ev.event_type.startsWith("reservation.") ? (ev.payload?.id as string | undefined) : undefined);
  if (!resolvedLocale && reservationId) {
    const { data: resRow } = await admin.from("reservations")
      .select("guest_language, guest_id").eq("id", reservationId).maybeSingle();
    const fromRes = normalizeLocale((resRow as { guest_language?: string } | null)?.guest_language);
    if (fromRes) { resolvedLocale = fromRes; localeSource = "reservation"; }
    else if ((resRow as { guest_id?: string } | null)?.guest_id) {
      const { data: g } = await admin.from("guests")
        .select("language").eq("id", (resRow as { guest_id: string }).guest_id).maybeSingle();
      const fromGuest = normalizeLocale((g as { language?: string } | null)?.language);
      if (fromGuest) { resolvedLocale = fromGuest; localeSource = "guest"; }
    }
  }
  if (!resolvedLocale) {
    const guestId = (ev.payload?.guest_id as string | undefined);
    if (guestId) {
      const { data: g } = await admin.from("guests")
        .select("language").eq("id", guestId).maybeSingle();
      const fromGuest = normalizeLocale((g as { language?: string } | null)?.language);
      if (fromGuest) { resolvedLocale = fromGuest; localeSource = "guest"; }
    }
  }
  if (!resolvedLocale) {
    const { data: rest } = await admin.from("restaurants")
      .select("default_locale").eq("id", ev.restaurant_id).maybeSingle();
    const fromRest = normalizeLocale((rest as { default_locale?: string } | null)?.default_locale);
    if (fromRest) { resolvedLocale = fromRest; localeSource = "restaurant_default"; }
  }
  if (!resolvedLocale) { resolvedLocale = "nl"; localeSource = "hardcoded_fallback"; }

  // Call: workflow trigger pattern (HighLevel: POST /workflows/{id}/trigger)
  const locationId = settings?.location_id || CLICKWISE_LOCATION_ID;
  const enrichedPayload = {
    ...(ev.payload as Record<string, unknown>),
    locale: resolvedLocale,
    language: resolvedLocale,
  };
  const result = await callClickWise(`/workflows/${wfId}/trigger`, {
    locationId,
    contactId,
    payload: enrichedPayload,
  });


  if (result.ok) {
    await admin.from("integration_events").update({
      status: "sent",
      processed_at: new Date().toISOString(),
      last_error: null,
      metadata: {
        ...(ev.metadata || {}),
        response: result.body,
        http_status: result.status,
        contact_upsert: contactUpsertResult,
        locale: resolvedLocale,
        locale_source: localeSource,
        mode: "live",
      },
    }).eq("id", ev.id);
    await audit(admin, ev.restaurant_id, "clickwise.workflow_triggered", ev.id, {
      event_type: ev.event_type, http_status: result.status, contact_id: contactId,
    });
    return { ok: true, contact_id: contactId };
  }

  await admin.from("integration_events").update({
    status: "failed",
    last_error: `ClickWise API fout (${result.status}): ${JSON.stringify(result.body).slice(0, 200)}`,
    metadata: { ...(ev.metadata || {}), contact_upsert: contactUpsertResult, http_status: result.status, mode: "live" },
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
