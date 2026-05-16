// Agent API — externe AI voice agents (Vapi, Retell, ClickWise) bellen deze endpoint
// om beschikbaarheid te checken, te boeken of te annuleren via TableWise.
//
// Auth: header X-Agent-Api-Key. Sleutel wordt vergeleken met sha-256 hash in agent_api_keys.
// Routes (POST):
//   /agent_api/check_availability
//   /agent_api/book_reservation
//   /agent_api/cancel_reservation
//   /agent_api/find_reservation
//   /agent_api/update_reservation
//   /agent_api/create_waitlist_entry
//   /agent_api/get_opening_hours
//   /agent_api/reconfirm_reservation
//   /agent_api/log_call           (provider stuurt afronding van gesprek)
//
// Geen JWT vereist (zie config.toml). Validatie gebeurt server-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders as baseCors } from "../_shared/cors.ts";
import { logIntegration } from "../_shared/integration-log.ts";

const corsHeaders = {
  ...baseCors,
  "Access-Control-Allow-Headers":
    (baseCors as Record<string, string>)["Access-Control-Allow-Headers"] +
    ", x-agent-api-key, X-Agent-Api-Key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authenticate(req: Request) {
  const key =
    req.headers.get("x-agent-api-key") ||
    req.headers.get("X-Agent-Api-Key") ||
    "";
  if (!key) return { error: "Missing X-Agent-Api-Key", error_code: "auth_missing", status: 401 };
  const hash = await sha256Hex(key);
  const sb = admin();
  const { data, error } = await sb
    .from("agent_api_keys")
    .select("id, restaurant_id, scopes, revoked_at, provider")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !data) return { error: "Invalid key", error_code: "auth_invalid", status: 401 };
  if (data.revoked_at) return { error: "Key revoked", error_code: "auth_revoked", status: 401 };
  // touch last_used_at (best effort)
  sb.from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});
  return { keyRow: data };
}

async function callInternalFn(name: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}

// ---- Guest-safe response wrapper ----
const INTERNAL_KEYS = [
  "internal_notes", "no_show_count", "no_show_risk", "no_show_risk_factors",
  "magic_token", "manage_token", "cancel_token", "clickwise_contact_id",
  "clickwise_workflow_status", "audit_log", "metadata", "source_metadata",
  "webhook_secret", "api_key", "key_hash",
];
function stripInternal<T extends Record<string, unknown>>(obj: T | null | undefined): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (INTERNAL_KEYS.includes(k)) continue;
    out[k] = v;
  }
  return out;
}
function guestSafeResponse(action: string, success: boolean, data: Record<string, unknown>) {
  return { success, action, ...stripInternal(data) };
}

// ---- Per-channel permission check ----
type ChannelKey = "voice" | "whatsapp" | "sms" | "webchat";
const CHANNEL_KEYS: ChannelKey[] = ["voice", "whatsapp", "sms", "webchat"];
async function checkChannelPermission(restaurantId: string, channel: string | undefined, action: string) {
  if (!channel) return { ok: true as const };
  if (!CHANNEL_KEYS.includes(channel as ChannelKey)) {
    return { ok: false as const, error: `Unknown channel '${channel}'`, error_code: "unknown_channel", status: 400 };
  }
  const sb = admin();
  const { data } = await sb.from("voice_agent_settings")
    .select("config").eq("restaurant_id", restaurantId).maybeSingle();
  const settings = (data?.config ?? {}) as Record<string, any>;
  const channels = settings.channels ?? {};
  const cfg = channels[channel];
  if (!cfg) return { ok: true as const }; // not yet configured: don't block
  if (cfg.enabled === false) {
    return { ok: false as const, error: `Channel '${channel}' is disabled`, error_code: "channel_disabled", status: 403 };
  }
  if (Array.isArray(cfg.allowed_actions) && !cfg.allowed_actions.includes(action)) {
    return { ok: false as const, error: `Action '${action}' not allowed for channel '${channel}'`, error_code: "channel_action_not_allowed", status: 403 };
  }
  return { ok: true as const, testMode: cfg.test_mode !== false };
}

async function handle(
  req: Request,
  ctx: { action: string; rawBody: any; setReservationId: (id: string | null) => void; setRestaurantId: (id: string) => void; setKeyPrefix: (p: string | null) => void; setProvider: (p: string | null) => void; },
): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed", error_code: "method_not_allowed" }, 405);

  const auth = await authenticate(req);
  if ("error" in auth) return json({ error: auth.error, error_code: auth.error_code }, auth.status);
  const { keyRow } = auth;
  ctx.setRestaurantId(keyRow.restaurant_id);
  ctx.setProvider(keyRow.provider ?? null);

  const payload: Record<string, unknown> = ctx.rawBody ?? {};
  payload.restaurant_id = keyRow.restaurant_id;

  const sb = admin();

  // Per-channel permission gating (optional `channel` field in payload).
  const channel = (payload.channel as string | undefined) || undefined;
  const channelCheck = await checkChannelPermission(keyRow.restaurant_id, channel, ctx.action);
  if (!channelCheck.ok) return json({ error: channelCheck.error, error_code: channelCheck.error_code }, channelCheck.status);

  try {
    switch (ctx.action) {
      case "check_availability": {
        if (!keyRow.scopes.includes("availability")) return json({ error: "Scope missing: availability", error_code: "auth_scope_missing", field: "availability" }, 403);
        const { date, party_size, preferred_time } = payload as { date?: string; party_size?: number; preferred_time?: string };
        if (!date) return json({ error: "date required (YYYY-MM-DD)", error_code: "missing_field", field: "date" }, 400);
        if (!party_size) return json({ error: "party_size required", error_code: "missing_field", field: "party_size" }, 400);
        if (!preferred_time) return json({ error: "preferred_time required (HH:mm)", error_code: "missing_field", field: "preferred_time" }, 400);
        if (!/^\d{2}:\d{2}$/.test(preferred_time)) return json({ error: "preferred_time must be HH:mm", error_code: "invalid_field", field: "preferred_time" }, 400);
        const r = await callInternalFn("availability", { restaurant_id: keyRow.restaurant_id, date, party_size });
        // Post-process: build exact + alternatives based on preferred_time.
        const body = r.body as { slots?: Array<{ time: string; available: boolean; available_table_count?: number }>; closed?: boolean; large_group?: boolean; message?: string } | null;
        const slots = body?.slots ?? [];
        const available = slots.filter((s) => s.available);
        const exact = available.find((s) => s.time.startsWith(preferred_time)) ?? null;
        const [ph, pm] = preferred_time.split(":").map(Number);
        const prefMin = ph * 60 + pm;
        const alternatives = [...available]
          .map((s) => {
            const [h, m] = s.time.split(":").map(Number);
            return { slot: s, dist: Math.abs(h * 60 + m - prefMin) };
          })
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3)
          .map((x) => x.slot);
        return json({
          ...body,
          preferred_time,
          available: available.length > 0,
          exact,
          alternatives,
        }, r.status);
      }
      case "book_reservation": {
        if (!keyRow.scopes.includes("book")) return json({ error: "Scope missing: book", error_code: "auth_scope_missing", field: "book" }, 403);
        const required = ["date", "time", "party_size", "guest"];
        for (const k of required) {
          if (!(k in payload)) return json({ error: `Missing field: ${k}`, error_code: "missing_field", field: k }, 400);
        }
        const guest = payload.guest as Record<string, unknown> | undefined;
        if (!guest?.first_name) return json({ error: "guest.first_name required", error_code: "missing_field", field: "guest.first_name" }, 400);
        if (!guest.email) guest.email = `voice-${Date.now()}@tablewise.local`;
        const bookBody = {
          ...payload,
          channel: "ai_host",
          source_metadata: { ...(payload.source_metadata as object | undefined), agent_provider: keyRow.provider, via: "agent_api" },
        };
        const r = await callInternalFn("book_reservation", bookBody);
        if (r.status >= 200 && r.status < 300 && (r.body as any)?.reservation_id) ctx.setReservationId((r.body as any).reservation_id);
        return json(r.body, r.status);
      }
      case "cancel_reservation": {
        if (!keyRow.scopes.includes("cancel")) return json({ error: "Scope missing: cancel", error_code: "auth_scope_missing", field: "cancel" }, 403);
        const { reservation_id, manage_token, reason } = payload as { reservation_id?: string; manage_token?: string; reason?: string };
        if (!reservation_id && !manage_token) return json({ error: "reservation_id or manage_token required", error_code: "missing_field", field: "reservation_id" }, 400);

        // Resolve reservation id from manage_token if needed
        let resolvedId = reservation_id ?? null;
        if (!resolvedId && manage_token) {
          const { data: row } = await sb
            .from("reservations").select("id")
            .eq("manage_token", manage_token).eq("restaurant_id", keyRow.restaurant_id).maybeSingle();
          if (!row) return json({ error: "Reservation not found", error_code: "not_found", field: "manage_token" }, 404);
          resolvedId = row.id;
        }

        // Delegate to manage_reservation for proper transition validation, audit logging and event emission.
        const r = await callInternalFn("manage_reservation", {
          action: "cancel",
          reservation_id: resolvedId,
          cancellation_reason: reason || "Geannuleerd via voice-agent",
        }, { "x-system-actor": `agent_api:${keyRow.provider ?? "voice"}` });
        if (r.status >= 200 && r.status < 300) ctx.setReservationId(resolvedId);
        return json(r.body, r.status);
      }
      case "log_call": {
        const { external_call_id, caller_phone, callee_phone, outcome, reservation_id, duration_seconds, cost_cents, transcript_url, summary, agent_id, metadata } = payload as Record<string, unknown>;
        const { error } = await sb.from("agent_call_logs").insert({
          restaurant_id: keyRow.restaurant_id,
          provider: keyRow.provider,
          agent_id: agent_id as string | null,
          external_call_id: external_call_id as string | null,
          caller_phone: caller_phone as string | null,
          callee_phone: callee_phone as string | null,
          outcome: outcome as string | null,
          reservation_id: (reservation_id as string | null) ?? null,
          duration_seconds: (duration_seconds as number | null) ?? null,
          cost_cents: (cost_cents as number | null) ?? null,
          transcript_url: transcript_url as string | null,
          summary: summary as string | null,
          metadata: (metadata as object) ?? {},
        });
        if (error) return json({ error: error.message, error_code: "internal" }, 400);
        return json({ ok: true });
      }
      case "find_reservation": {
        if (!keyRow.scopes.includes("availability")) return json({ error: "Scope missing: availability", error_code: "auth_scope_missing", field: "availability" }, 403);
        const { phone, date } = payload as { phone?: string; date?: string };
        if (!phone) return json({ error: "phone required", error_code: "missing_field", field: "phone" }, 400);
        const normalizedPhone = phone.replace(/\s+/g, "");
        // Find guests in this restaurant matching phone
        const { data: guests } = await sb.from("guests")
          .select("id, first_name")
          .eq("restaurant_id", keyRow.restaurant_id)
          .ilike("phone", `%${normalizedPhone.slice(-8)}%`);
        if (!guests || guests.length === 0) {
          return json(guestSafeResponse("find_reservation", true, {
            matches: [],
            message_for_guest: "Ik kan geen reservering op dit nummer vinden.",
          }));
        }
        const guestIds = guests.map((g) => g.id);
        let q = sb.from("reservations")
          .select("id, reservation_date, start_time, party_size, status, guest_id")
          .eq("restaurant_id", keyRow.restaurant_id)
          .in("guest_id", guestIds)
          .in("status", ["confirmed", "pending", "seated"])
          .gte("start_time", new Date().toISOString())
          .order("start_time", { ascending: true })
          .limit(5);
        if (date) q = q.eq("reservation_date", date);
        const { data: reservations } = await q;
        const guestMap = new Map(guests.map((g) => [g.id, g.first_name]));
        const matches = (reservations ?? []).map((r) => ({
          reservation_id: r.id,
          date: r.reservation_date,
          time: r.start_time,
          party_size: r.party_size,
          status: r.status,
          guest_first_name: guestMap.get(r.guest_id ?? "") ?? null,
        }));
        return json(guestSafeResponse("find_reservation", true, {
          matches,
          message_for_guest: matches.length === 0
            ? "Ik kan geen actieve reservering op dit nummer vinden."
            : matches.length === 1
              ? `Ik heb je reservering gevonden voor ${matches[0].party_size} personen.`
              : `Ik vond ${matches.length} reserveringen op dit nummer. Welke bedoel je?`,
        }));
      }
      case "update_reservation": {
        if (!keyRow.scopes.includes("update") && !keyRow.scopes.includes("book"))
          return json({ error: "Scope missing: update", error_code: "auth_scope_missing", field: "update" }, 403);
        const { reservation_id, confirmed_by_guest, new_date, new_time, new_party_size, notes } = payload as {
          reservation_id?: string; confirmed_by_guest?: boolean;
          new_date?: string; new_time?: string; new_party_size?: number; notes?: string;
        };
        if (!reservation_id) return json({ error: "reservation_id required", error_code: "missing_field", field: "reservation_id" }, 400);
        if (confirmed_by_guest !== true) {
          return json(guestSafeResponse("update_reservation", false, {
            reason_code: "confirmation_required",
            message_for_guest: "Wil je bevestigen dat je deze wijziging wilt doorvoeren?",
          }), 200);
        }
        const updates: Record<string, unknown> = {};
        if (new_date) updates.reservation_date = new_date;
        if (new_time) updates.start_time = new_time;
        if (new_party_size) updates.party_size = new_party_size;
        if (notes) updates.special_requests = notes;
        const r = await callInternalFn("manage_reservation", {
          action: "update",
          reservation_id,
          ...updates,
        }, { "x-system-actor": `agent_api:${keyRow.provider ?? "voice"}` });
        if (r.status >= 200 && r.status < 300) ctx.setReservationId(reservation_id);
        return json(guestSafeResponse("update_reservation", r.status < 300, {
          ...(r.body as Record<string, unknown>),
          message_for_guest: r.status < 300
            ? "Je reservering is bijgewerkt."
            : "Het lukte niet om je reservering bij te werken. Een medewerker neemt contact op.",
        }), r.status);
      }
      case "create_waitlist_entry": {
        if (!keyRow.scopes.includes("book")) return json({ error: "Scope missing: book", error_code: "auth_scope_missing", field: "book" }, 403);
        const { guest_name, guest_phone, guest_email, desired_date, party_size, desired_time_from, desired_time_to, notes } = payload as {
          guest_name?: string; guest_phone?: string; guest_email?: string;
          desired_date?: string; party_size?: number;
          desired_time_from?: string; desired_time_to?: string; notes?: string;
        };
        if (!guest_name) return json({ error: "guest_name required", error_code: "missing_field", field: "guest_name" }, 400);
        if (!guest_phone) return json({ error: "guest_phone required", error_code: "missing_field", field: "guest_phone" }, 400);
        if (!desired_date) return json({ error: "desired_date required", error_code: "missing_field", field: "desired_date" }, 400);
        if (!party_size) return json({ error: "party_size required", error_code: "missing_field", field: "party_size" }, 400);
        const [first, ...rest] = guest_name.trim().split(/\s+/);
        const { data: entry, error: insErr } = await sb.from("waitlist_entries").insert({
          restaurant_id: keyRow.restaurant_id,
          first_name: first,
          last_name: rest.join(" ") || null,
          phone: guest_phone,
          email: guest_email ?? null,
          party_size,
          desired_date,
          desired_time_from: desired_time_from ?? "18:00",
          desired_time_to: desired_time_to ?? "21:00",
          notes: notes ?? null,
          channel: "ai_host",
          source_metadata: { via: "agent_api", agent_provider: keyRow.provider },
        }).select("id").single();
        if (insErr) return json({ error: insErr.message, error_code: "internal" }, 400);
        await sb.from("integration_events").insert({
          restaurant_id: keyRow.restaurant_id,
          event_type: "waitlist.created",
          entity_type: "waitlist_entry",
          entity_id: entry.id,
          payload: { source: "agent_api", provider: keyRow.provider },
        });
        return json(guestSafeResponse("create_waitlist_entry", true, {
          waitlist_entry_id: entry.id,
          message_for_guest: "Je staat op de wachtlijst. Als er plek vrijkomt, neemt het restaurant contact op.",
        }));
      }
      case "get_opening_hours": {
        const { date } = payload as { date?: string };
        const targetDate = date ? new Date(date) : new Date();
        const weekdayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
        const weekday = weekdayNames[targetDate.getUTCDay()];
        const dateStr = targetDate.toISOString().slice(0, 10);
        const [{ data: hours }, { data: closures }] = await Promise.all([
          sb.from("opening_hours").select("weekday, open_time, close_time, is_closed")
            .eq("restaurant_id", keyRow.restaurant_id).eq("weekday", weekday),
          sb.from("closures").select("start_date, end_date, start_time, end_time, is_full_day, reason")
            .eq("restaurant_id", keyRow.restaurant_id)
            .lte("start_date", dateStr).gte("end_date", dateStr),
        ]);
        const isClosed = (hours ?? []).every((h: any) => h.is_closed) || (closures ?? []).some((c: any) => c.is_full_day);
        return json(guestSafeResponse("get_opening_hours", true, {
          date: dateStr,
          weekday,
          is_open: !isClosed && (hours ?? []).length > 0,
          hours: hours ?? [],
          closures: closures ?? [],
          message_for_guest: isClosed
            ? "Het restaurant is gesloten op die dag."
            : (hours ?? []).length > 0
              ? `We zijn open van ${(hours as any)[0].open_time} tot ${(hours as any)[0].close_time}.`
              : "Ik kan de openingstijden voor die dag niet vinden.",
        }));
      }
      case "reconfirm_reservation": {
        if (!keyRow.scopes.includes("update") && !keyRow.scopes.includes("book"))
          return json({ error: "Scope missing: update", error_code: "auth_scope_missing", field: "update" }, 403);
        const { reservation_id, response } = payload as { reservation_id?: string; response?: string };
        if (!reservation_id) return json({ error: "reservation_id required", error_code: "missing_field", field: "reservation_id" }, 400);
        if (response !== "confirmed" && response !== "cannot_come")
          return json({ error: "response must be 'confirmed' or 'cannot_come'", error_code: "invalid_field", field: "response" }, 400);
        const sysHeader = { "x-system-actor": `agent_api:${keyRow.provider ?? "voice"}` };
        const r = response === "confirmed"
          ? await callInternalFn("manage_reservation", { action: "reconfirmation", reservation_id, sub_action: "guest_confirmed" }, sysHeader)
          : await callInternalFn("manage_reservation", { action: "cancel", reservation_id, cancellation_reason: "Gast kan niet komen (via AI)" }, sysHeader);
        if (r.status >= 200 && r.status < 300) ctx.setReservationId(reservation_id);
        return json(guestSafeResponse("reconfirm_reservation", r.status < 300, {
          ...(r.body as Record<string, unknown>),
          message_for_guest: response === "confirmed"
            ? "Bedankt, je reservering is bevestigd."
            : "Bedankt voor het laten weten. Je reservering is geannuleerd.",
        }), r.status);
      }
      default:
        return json({ error: `Unknown action '${ctx.action}'.`, error_code: "unknown_action", field: "action" }, 404);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg, error_code: "internal" }, 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const action = segments[segments.length - 1] || "";

  let rawBody: any = undefined;
  try { rawBody = await req.clone().json(); } catch { /* none */ }

  const apiKeyHeader = req.headers.get("X-Agent-Api-Key") || req.headers.get("x-agent-api-key") || "";
  const initialPrefix = apiKeyHeader ? apiKeyHeader.slice(0, 12) : null;

  let restaurantId: string | null = null;
  let reservationId: string | null = null;
  let keyPrefix: string | null = initialPrefix;
  let provider: string | null = null;

  const response = await handle(req, {
    action,
    rawBody,
    setReservationId: (id) => { reservationId = id; },
    setRestaurantId: (id) => { restaurantId = id; },
    setKeyPrefix: (p) => { keyPrefix = p; },
    setProvider: (p) => { provider = p; },
  });

  // Read response body for log
  let respBody: any = undefined;
  try { respBody = await response.clone().json(); } catch { /* skip */ }

  if (restaurantId) {
    const isSuccess = response.status >= 200 && response.status < 300;
    const actionMap: Record<string, string> = {
      check_availability: "check_availability",
      book_reservation: "create_reservation",
      cancel_reservation: "cancel_reservation",
      find_reservation: "find_reservation",
      update_reservation: "update_reservation",
      create_waitlist_entry: "create_waitlist_entry",
      get_opening_hours: "get_opening_hours",
      reconfirm_reservation: "reconfirm_reservation",
      log_call: "log_call",
    };
    logIntegration({
      restaurantId,
      source: "voice_agent",
      action: actionMap[action] ?? action,
      status: isSuccess ? "success" : "failed",
      httpStatus: response.status,
      latencyMs: Date.now() - startedAt,
      errorCode: respBody?.error_code ?? null,
      errorMessage: respBody?.error ?? null,
      requestPayload: rawBody,
      responsePayload: respBody,
      reservationId,
      apiKeyPrefix: keyPrefix,
      metadata: { method: req.method, path: url.pathname, provider, agent_action: action },
    });
  }

  return response;
});
