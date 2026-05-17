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

// Sommige voice agents sturen gastvelden plat (first_name, phone, ...) i.p.v.
// genest onder `guest`. We normaliseren beide vormen naar een `guest`-object.
function normalizeGuest(payload: Record<string, any>): Record<string, any> {
  if (payload.guest && typeof payload.guest === "object") return payload;
  const flatKeys = ["first_name", "last_name", "phone", "email", "name", "full_name", "guest_name", "guest_phone", "guest_email"];
  const hasFlat = flatKeys.some((k) => payload[k] != null);
  if (!hasFlat) return payload;
  const rawName = payload.full_name ?? payload.name ?? payload.guest_name ?? null;
  let first = payload.first_name ?? null;
  let last = payload.last_name ?? null;
  if (!first && rawName) {
    const parts = String(rawName).trim().split(/\s+/);
    first = parts.shift() ?? null;
    if (!last && parts.length) last = parts.join(" ");
  }
  const guest: Record<string, any> = {
    first_name: first,
    last_name: last,
    phone: payload.phone ?? payload.guest_phone ?? null,
    email: payload.email ?? payload.guest_email ?? null,
  };
  return { ...payload, guest };
}

// Blokkeer placeholder-namen die voice-agents invullen als ze vergeten te vragen.
// Dwingt de LLM om expliciet naar de naam te vragen i.p.v. "Gast" in te vullen.
const PLACEHOLDER_NAMES = new Set([
  "gast", "guest", "klant", "customer", "onbekend", "unknown",
  "anoniem", "anonymous", "test", "naam", "name", "n.v.t.", "nvt",
  "-", "x", "xx", "xxx", "?", "??", "geen", "none", "null", "undefined",
]);
function isPlaceholderName(s: unknown): boolean {
  if (typeof s !== "string") return true;
  const v = s.trim().toLowerCase();
  if (v.length < 2) return true;
  return PLACEHOLDER_NAMES.has(v);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Bouw een uniforme, gastvrije response voor zowel `reservation_request`
// als de oudere `book_reservation`-tool. De LLM krijgt altijd een veld
// `message_for_guest` om LETTERLIJK voor te lezen + een `next_action`
// die de workflow uniek aanstuurt. Zo kan een parafraserende LLM nooit
// "geboekt" zeggen terwijl een grote-groepsreservering nog op goedkeuring
// wacht.
// Stel tenant-driven, gastvrije pending-zin samen. Volgorde:
// 1) `large_group_confirmation_text` (vrije tekst van het restaurant)
// 2) anders een neutrale zin + dynamische staart gebaseerd op
//    `large_group_response_sla_label` en `large_group_response_channel_label`
//    zodat tenants zelf bepalen óf en hoe ze een SLA + kanaal beloven.
function composeLargeGroupPendingMessage(
  partySize: number, dateStr: string, timeStr: string,
  tenantCopy?: string | null, slaLabel?: string | null, channelLabel?: string | null,
) {
  const free = (tenantCopy ?? "").trim();
  if (free) return free;
  const sla = (slaLabel ?? "").trim();
  const channel = (channelLabel ?? "").trim();
  const tail =
    sla && channel ? ` U ontvangt ${sla} een bericht ${channel}.`
    : sla ? ` U ontvangt ${sla} een bericht.`
    : channel ? ` U ontvangt een bericht ${channel}.`
    : ` Het restaurant laat het u zo snel mogelijk weten.`;
  return `Uw aanvraag voor ${partySize} personen op ${dateStr} om ${timeStr} is voorlopig genoteerd.${tail}`;
}

function buildBookGuestResponse(
  r: { status: number; body: Record<string, any> | null },
  ctx: {
    partySize: number;
    dateStr: string;
    timeStr: string;
    onlineHardCap: number;
    largeGroupConfirmationText?: string | null;
    largeGroupSlaLabel?: string | null;
    largeGroupChannelLabel?: string | null;
  },
) {
  const rb = (r.body ?? {}) as Record<string, any>;
  const reservationObj = rb.reservation ?? {};
  const requiresManual = rb.requires_manual_approval ?? reservationObj?.requires_manual_approval ?? false;
  const { partySize, dateStr, timeStr, onlineHardCap, largeGroupConfirmationText, largeGroupSlaLabel, largeGroupChannelLabel } = ctx;

  let messageForGuest: string | null = rb.message_for_guest ?? null;
  let nextAction = "confirm_booking";
  let statusLabel: "definitief" | "voorlopig" = "definitief";
  let responseStatus = r.status;
  let responseOk = r.status >= 200 && r.status < 300;

  if (r.status >= 400) {
    const ec = rb.error_code as string | undefined;
    if (ec === "large_group_required_manual") {
      const allowTransfer = partySize > onlineHardCap && rb.transfer?.allowed === true;
      nextAction = allowTransfer ? "transfer_call" : "promise_callback";
      statusLabel = "voorlopig";
      messageForGuest = allowTransfer
        ? "Een moment, ik verbind u door met een collega."
        : composeLargeGroupPendingMessage(partySize, dateStr, timeStr, largeGroupConfirmationText, largeGroupSlaLabel, largeGroupChannelLabel);
      if (!allowTransfer) rb.transfer = { ...(rb.transfer ?? {}), allowed: false };
    } else if (ec === "no_table_available" || ec === "slot_unavailable" || ec === "pacing_limit_reached") {
      nextAction = "offer_alternatives_or_waitlist";
      messageForGuest = "Helaas lukt dit specifieke tijdstip niet. Kunt u iets eerder of later? Anders zet ik u graag op onze wachtlijst.";
      responseStatus = 200;
      responseOk = true;
      rb.transfer = { ...(rb.transfer ?? {}), allowed: false };
    } else if (ec === "message_required") {
      nextAction = "ask_special_requests";
      messageForGuest = "Voor deze groepsgrootte noteer ik graag nog een korte toelichting voor het team. Zijn er bijzonderheden waar we rekening mee mogen houden?";
      responseStatus = 200;
      responseOk = true;
      rb.transfer = { ...(rb.transfer ?? {}), allowed: false };
    } else if (ec === "slot_too_soon") {
      nextAction = "ask_later_time";
      messageForGuest = "Dat tijdstip is helaas te kort dag. Kunt u een iets later tijdstip kiezen?";
      responseStatus = 200;
      responseOk = true;
      rb.transfer = { ...(rb.transfer ?? {}), allowed: false };
    } else if (ec === "beyond_booking_horizon") {
      const maxDateLabel = rb.max_booking_date
        ? new Date(String(rb.max_booking_date) + "T00:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
        : "enkele maanden vooruit";
      nextAction = "ask_closer_date";
      messageForGuest = `Die datum valt helaas te ver in de toekomst. U kunt tot ${maxDateLabel} reserveren. Wilt u een eerdere datum proberen?`;
      responseStatus = 200;
      responseOk = true;
      rb.transfer = { ...(rb.transfer ?? {}), allowed: false };
    } else {
      nextAction = "apologize_and_callback";
      messageForGuest = "Sorry, er ging iets mis aan onze kant. Probeert u het later nog eens, of reserveer via de website.";
    }
  } else if (requiresManual) {
    nextAction = "confirm_pending_approval";
    statusLabel = "voorlopig";
    messageForGuest = composeLargeGroupPendingMessage(partySize, dateStr, timeStr, largeGroupConfirmationText, largeGroupSlaLabel, largeGroupChannelLabel);
  } else {
    messageForGuest = messageForGuest ?? `Top, jullie tafel staat genoteerd, tot ${dateStr} om ${timeStr}.`;
  }

  const isConfirmed = responseOk && !requiresManual && r.status < 400;

  return {
    body: {
      ok: responseOk,
      confirmed: isConfirmed,
      reservation_id: reservationObj?.id ?? rb.reservation_id ?? null,
      confirmation_code: reservationObj?.confirmation_code ?? rb.confirmation_code ?? null,
      requires_manual_approval: requiresManual,
      large_group_status: rb.large_group_status ?? reservationObj?.large_group_status ?? null,
      status_label: statusLabel,
      error_code: rb.error_code ?? null,
      transfer: rb.transfer ?? null,
      message_for_guest: messageForGuest,
      next_action: nextAction,
      forbidden_phrases: !isConfirmed
        ? ["geboekt", "bevestigd", "gelukt", "rond", "definitief", "akkoord", "goedgekeurd"]
        : [],
    },
    status: responseStatus,
    reservationId: reservationObj?.id ?? rb.reservation_id ?? null,
  };
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
        if (preferred_time && !/^\d{2}:\d{2}$/.test(preferred_time)) return json({ error: "preferred_time must be HH:mm", error_code: "invalid_field", field: "preferred_time" }, 400);
        const r = await callInternalFn("availability", { restaurant_id: keyRow.restaurant_id, date, party_size });
        const body = r.body as { slots?: Array<{ time: string; available: boolean; available_table_count?: number }>; closed?: boolean; large_group?: boolean; message?: string } | null;
        const slots = body?.slots ?? [];
        const available = slots.filter((s) => s.available);
        const exact = preferred_time ? available.find((s) => s.time.startsWith(preferred_time)) ?? null : null;
        const [ph, pm] = (preferred_time ?? "18:00").split(":").map(Number);
        const prefMin = ph * 60 + pm;
        const alternatives = [...available]
          .map((s) => {
            const [h, m] = s.time.split(":").map(Number);
            return { slot: s, dist: Math.abs(h * 60 + m - prefMin) };
          })
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3)
          .map((x) => ({ time: x.slot.time }));
        // Compact response — geen volledige slotlijst meer, voorkomt dat de LLM
        // in de ruis verdwaalt en stopt vóór book_reservation.
        const closed = body?.closed === true;
        const largeGroup = body?.large_group === true;
        const canBookExact = !!exact;
        const nextAction = closed
          ? "say_closed"
          : largeGroup
            ? "use_reservation_request_anyway"
            : canBookExact
              ? "book_now"
              : alternatives.length > 0
                ? "offer_alternatives"
                : "offer_waitlist";
        return json({
          preferred_time: preferred_time ?? null,
          available: canBookExact,
          can_book_exact: canBookExact,
          exact: exact ? { time: exact.time } : null,
          alternatives,
          closed,
          large_group: largeGroup,
          message: preferred_time ? (body?.message ?? null) : "Welke tijd heeft uw voorkeur?",
          next_action: preferred_time ? nextAction : "ask_preferred_time",
        }, r.status);
      }
      case "reservation_request": {
        // Eén-call-flow voor de voice agent: valideer → book_reservation.
        // Bewuste keuze om GEEN losse availability-check te doen — book_reservation
        // doet zelf alle checks (capaciteit, tafels, pacing) en geeft heldere errors.
        // Dit voorkomt dat de LLM tussen availability en book_reservation stopt.
        if (!keyRow.scopes.includes("book")) return json({ error: "Scope missing: book", error_code: "auth_scope_missing", field: "book" }, 403);
        Object.assign(payload, normalizeGuest(payload as Record<string, any>));
        const required = ["date", "time", "party_size", "guest"];
        for (const k of required) {
          if (!(k in payload)) return json({ error: `Missing field: ${k}`, error_code: "missing_field", field: k }, 400);
        }
        const guest = payload.guest as Record<string, unknown> | undefined;
        if (!guest?.first_name || isPlaceholderName(guest.first_name)) {
          return json({
            error: "Vraag altijd expliciet naar de voornaam van de gast. Vul nooit zelf 'Gast' of een andere placeholder in.",
            error_code: "placeholder_name_blocked",
            field: "guest.first_name",
          }, 400);
        }
        if (!guest.phone) return json({ error: "guest.phone required", error_code: "missing_field", field: "guest.phone" }, 400);
        if (!guest.email) guest.email = `voice-${Date.now()}@tablewise.local`;
        const bookBody = {
          ...payload,
          channel: "ai_host",
          source_metadata: { ...(payload.source_metadata as object | undefined), agent_provider: keyRow.provider, via: "agent_api/reservation_request" },
        };
        const r = await callInternalFn("book_reservation", bookBody);
        const rb0 = (r.body ?? {}) as Record<string, any>;
        const resObj0 = rb0.reservation ?? {};
        if (r.status >= 200 && r.status < 300 && resObj0?.id) ctx.setReservationId(resObj0.id);
        const { data: restRow } = await sb.from("restaurants")
          .select("large_group_max_online_request, max_party_size_online, large_group_confirmation_text, large_group_response_sla_label, large_group_response_channel_label")
          .eq("id", keyRow.restaurant_id).maybeSingle();
        const onlineHardCap: number = (restRow?.large_group_max_online_request ?? restRow?.max_party_size_online ?? 18) as number;

        // --- GROTE GROEP VANGNET ---
        // Wanneer book_reservation de groep weigert wegens overschrijding van de online cap,
        // sla de aanvraag op in large_group_requests — net als de widget doet — zodat het
        // restaurant de aanvraag écht in de UI ziet.
        if (r.status >= 400 && rb0.error_code === "large_group_required_manual") {
          const gAny = (payload.guest ?? {}) as Record<string, any>;
          const contactName = [gAny.first_name, gAny.last_name].filter(Boolean).join(" ").trim() || "Onbekend";
          const sourceLine = `[bron: voice-agent / ${keyRow.provider ?? "ai_host"}]`;
          const lgInsert = await sb.from("large_group_requests").insert({
            restaurant_id: keyRow.restaurant_id,
            contact_name: contactName,
            contact_phone: gAny.phone ?? null,
            contact_email: gAny.email ?? null,
            party_size: Number((payload as any).party_size) || 0,
            preferred_date: ((payload as any).date ? String((payload as any).date) : null),
            preferred_time: ((payload as any).time ? String((payload as any).time) : null),
            message: [
              (payload as any).special_requests ? String((payload as any).special_requests) : null,
              sourceLine,
            ].filter(Boolean).join("\n\n"),
            status: "new",
          }).select("id").maybeSingle();
          const lgReq = lgInsert.data;
          if (lgReq?.id) {
            rb0.large_group_request_id = lgReq.id;
            // Audit + integration event (fire-and-forget)
            sb.from("audit_log").insert({
              restaurant_id: keyRow.restaurant_id,
              action: "large_group_request.created",
              entity: "large_group_request",
              entity_id: lgReq.id,
              actor_label: `agent_api:${keyRow.provider ?? "voice"}`,
              after_data: {
                source: "agent_api",
                party_size: Number((payload as any).party_size) || 0,
                preferred_date: (payload as any).date ?? null,
                preferred_time: (payload as any).time ?? null,
              },
            }).then(() => {}).catch(() => {});
            sb.from("integration_events").insert({
              restaurant_id: keyRow.restaurant_id,
              event_type: "large_group_request.created",
              entity_type: "large_group_request",
              entity_id: lgReq.id,
              payload: {
                source: "agent_api",
                source_channel: "phone_ai",
                provider: keyRow.provider,
                party_size: Number((payload as any).party_size) || 0,
                preferred_date: (payload as any).date ?? null,
                preferred_time: (payload as any).time ?? null,
                contact_name: contactName,
                contact_phone: gAny.phone ?? null,
              },
            }).then(() => {}).catch(() => {});
          }
        }

        const built = buildBookGuestResponse(r, {
          partySize: Number((payload as any).party_size) || 0,
          dateStr: String((payload as any).date ?? ""),
          timeStr: String((payload as any).time ?? ""),
          onlineHardCap,
          largeGroupConfirmationText: restRow?.large_group_confirmation_text ?? null,
        });
        return json(built.body, built.status);
      }
      case "book_reservation": {
        if (!keyRow.scopes.includes("book")) return json({ error: "Scope missing: book", error_code: "auth_scope_missing", field: "book" }, 403);
        Object.assign(payload, normalizeGuest(payload as Record<string, any>));
        const required = ["date", "time", "party_size", "guest"];
        for (const k of required) {
          if (!(k in payload)) return json({ error: `Missing field: ${k}`, error_code: "missing_field", field: k }, 400);
        }
        const guest = payload.guest as Record<string, unknown> | undefined;
        if (!guest?.first_name || isPlaceholderName(guest.first_name)) {
          return json({
            error: "Vraag altijd expliciet naar de voornaam van de gast. Vul nooit zelf 'Gast' of een andere placeholder in.",
            error_code: "placeholder_name_blocked",
            field: "guest.first_name",
          }, 400);
        }
        if (!guest.email) guest.email = `voice-${Date.now()}@tablewise.local`;
        const bookBody = {
          ...payload,
          channel: "ai_host",
          source_metadata: { ...(payload.source_metadata as object | undefined), agent_provider: keyRow.provider, via: "agent_api" },
        };
        const r = await callInternalFn("book_reservation", bookBody);
        const rb0 = (r.body ?? {}) as Record<string, any>;
        const resObj0 = rb0.reservation ?? {};
        if (r.status >= 200 && r.status < 300 && resObj0?.id) ctx.setReservationId(resObj0.id);
        // DEPRECATED tool: gebruik dezelfde gastvrije response-vorm als
        // `reservation_request` zodat een parafraserende LLM nooit "geboekt"
        // kan zeggen terwijl de reservering nog op handmatige goedkeuring wacht.
        const { data: restRow2 } = await sb.from("restaurants")
          .select("large_group_max_online_request, max_party_size_online, large_group_confirmation_text")
          .eq("id", keyRow.restaurant_id).maybeSingle();
        const onlineHardCap2: number = (restRow2?.large_group_max_online_request ?? restRow2?.max_party_size_online ?? 18) as number;
        const built2 = buildBookGuestResponse(r, {
          partySize: Number((payload as any).party_size) || 0,
          dateStr: String((payload as any).date ?? ""),
          timeStr: String((payload as any).time ?? ""),
          onlineHardCap: onlineHardCap2,
          largeGroupConfirmationText: restRow2?.large_group_confirmation_text ?? null,
        });
        return json(built2.body, built2.status);
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
        // Adapter: accepteert zowel ons interne schema als de native ClickWise/HighLevel
        // post-call webhook payload (call.id, from, to, duration, transcript, ...).
        const p = payload as Record<string, any>;
        const call = (p.call ?? {}) as Record<string, any>;
        const external_call_id = p.external_call_id ?? call.id ?? p.call_id ?? null;
        const caller_phone = p.caller_phone ?? p.from ?? call.from ?? null;
        const callee_phone = p.callee_phone ?? p.to ?? call.to ?? null;
        const outcome = p.outcome ?? call.status ?? p.status ?? null;
        const reservation_id = p.reservation_id ?? p.tw_reservation_id ?? null;
        const duration_seconds = p.duration_seconds ?? p.duration ?? call.duration ?? null;
        // cost kan in dollars (number) of cents binnenkomen
        const rawCost = p.cost_cents ?? p.cost ?? call.cost ?? null;
        const cost_cents = typeof rawCost === "number"
          ? (rawCost < 100 && rawCost > 0 ? Math.round(rawCost * 100) : Math.round(rawCost))
          : null;
        const transcript_url = p.transcript_url ?? call.transcript_url ?? p.recording_url ?? call.recording_url ?? null;
        const summary = p.summary ?? call.summary ?? null;
        const agent_id = p.agent_id ?? call.agent_id ?? null;
        const transcript = p.transcript ?? call.transcript ?? null;
        const metadata = {
          ...(typeof p.metadata === "object" && p.metadata ? p.metadata : {}),
          ...(transcript ? { transcript } : {}),
          ...(p.recording_url ? { recording_url: p.recording_url } : {}),
          source_payload_keys: Object.keys(p).slice(0, 30),
        };
        const { error } = await sb.from("agent_call_logs").insert({
          restaurant_id: keyRow.restaurant_id,
          provider: keyRow.provider,
          agent_id,
          external_call_id,
          caller_phone,
          callee_phone,
          outcome,
          reservation_id,
          duration_seconds,
          cost_cents,
          transcript_url,
          summary,
          metadata,
        });
        if (error) return json({ error: error.message, error_code: "internal" }, 400);
        return json({ ok: true, external_call_id });
      }
      case "find_reservation": {
        if (!keyRow.scopes.includes("availability")) return json({ error: "Scope missing: availability", error_code: "auth_scope_missing", field: "availability" }, 403);
        const { phone, date, first_name, last_name, time, confirmation_code } = payload as {
          phone?: string; date?: string; first_name?: string; last_name?: string; time?: string; confirmation_code?: string;
        };
        const hasPhone = !!phone && phone.trim().length > 0;
        const hasLast = !!last_name && last_name.trim().length > 0;
        const hasFirstPlusDate = !!first_name && first_name.trim().length > 0 && !!date;
        const codeRaw = (confirmation_code ?? "").trim().toUpperCase();
        const hasCode = /^[A-Z0-9]{3,12}$/.test(codeRaw);

        if (hasCode) {
          const { data: directMatch } = await sb.from("reservations")
            .select("id, reservation_date, start_time, party_size, status, guest_id, confirmation_code")
            .eq("restaurant_id", keyRow.restaurant_id)
            .eq("confirmation_code", codeRaw)
            .in("status", ["confirmed", "pending", "seated"])
            .limit(1);
          if (directMatch && directMatch.length > 0) {
            const rr = directMatch[0];
            const { data: guestRow } = await sb.from("guests")
              .select("first_name").eq("id", rr.guest_id ?? "").maybeSingle();
            return json(guestSafeResponse("find_reservation", true, {
              matches: [{
                reservation_id: rr.id,
                date: rr.reservation_date,
                time: rr.start_time,
                party_size: rr.party_size,
                status: rr.status,
                guest_first_name: guestRow?.first_name ?? null,
              }],
              message_for_guest: `Ik heb je reservering gevonden voor ${rr.party_size} personen.`,
            }));
          }
          if (!hasPhone && !hasLast && !hasFirstPlusDate) {
            return json(guestSafeResponse("find_reservation", true, {
              matches: [],
              message_for_guest: "Ik kan geen reservering vinden met die code. Kunt u uw naam of telefoonnummer doorgeven?",
            }));
          }
        }

        if (!hasPhone && !hasLast && !hasFirstPlusDate && !hasCode) {
          return json({ error: "Geef telefoon, of achternaam, of voornaam + datum", error_code: "missing_field", field: "phone" }, 400);
        }
        // Find guests in this restaurant matching phone or name
        let guestQuery = sb.from("guests")
          .select("id, first_name, last_name, phone")
          .eq("restaurant_id", keyRow.restaurant_id)
          .limit(50);
        if (hasPhone) {
          const normalizedPhone = phone!.replace(/\s+/g, "");
          guestQuery = guestQuery.ilike("phone", `%${normalizedPhone.slice(-8)}%`);
        } else {
          if (hasLast) guestQuery = guestQuery.ilike("last_name", `%${last_name!.trim()}%`);
          if (first_name && first_name.trim().length > 0) guestQuery = guestQuery.ilike("first_name", `%${first_name!.trim()}%`);
        }
        const { data: guests } = await guestQuery;
        if (!guests || guests.length === 0) {
          return json(guestSafeResponse("find_reservation", true, {
            matches: [],
            message_for_guest: "Ik kan geen reservering vinden met die gegevens.",
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
          .limit(10);
        if (date) q = q.eq("reservation_date", date);
        const { data: reservations } = await q;
        let filtered = reservations ?? [];
        if (time && /^\d{2}:\d{2}$/.test(time)) {
          const [th, tm] = time.split(":").map(Number);
          const target = th * 60 + tm;
          filtered = filtered.filter((r) => {
            const d = new Date(r.start_time as string);
            const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
            // Also try local string parse fallback
            const m = String(r.start_time).match(/T(\d{2}):(\d{2})/);
            const localMins = m ? Number(m[1]) * 60 + Number(m[2]) : mins;
            return Math.abs(localMins - target) <= 15;
          });
        }
        const guestMap = new Map(guests.map((g) => [g.id, g.first_name]));
        const matches = filtered.slice(0, 5).map((r) => ({
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
            ? "Ik kan geen actieve reservering vinden met die gegevens."
            : matches.length === 1
              ? `Ik heb je reservering gevonden voor ${matches[0].party_size} personen.`
              : `Ik vond ${matches.length} reserveringen. Welke bedoel je?`,
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
            : "Het lukte helaas niet om je reservering bij te werken. Probeert u het later nog eens, of neem contact op met het restaurant.",
        }), r.status);
      }
      case "create_waitlist_entry": {
        if (!keyRow.scopes.includes("book")) return json({ error: "Scope missing: book", error_code: "auth_scope_missing", field: "book" }, 403);
        // Accepteer ook flat first_name/last_name/phone/email of guest-object i.p.v. guest_*-prefix.
        const p = payload as Record<string, any>;
        const flat = normalizeGuest(p);
        const g = (flat.guest ?? {}) as Record<string, any>;
        const joined = [g.first_name, g.last_name].filter(Boolean).join(" ").trim();
        const fullName = p.guest_name ?? p.full_name ?? p.name ?? (joined || null);
        const guest_name: string | undefined = fullName || undefined;
        const guest_phone: string | undefined = p.guest_phone ?? g.phone ?? p.phone ?? undefined;
        const guest_email: string | undefined = p.guest_email ?? g.email ?? p.email ?? undefined;
        const { desired_date, party_size, desired_time_from, desired_time_to, notes } = p as {
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
          message_for_guest: "Je staat op de wachtlijst. Als er plek vrijkomt, laat het restaurant het je weten.",
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
      reservation_request: "create_reservation",
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
