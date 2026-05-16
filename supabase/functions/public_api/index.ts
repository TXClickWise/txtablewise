// TableWise Public API — Guestplan-style external endpoints.
//
// Routes (POST/PATCH/DELETE):
//   POST   /public_api/availability
//   POST   /public_api/reservations
//   PATCH  /public_api/reservations/:id
//   DELETE /public_api/reservations/:id
//
// Auth: header `X-TableWise-Api-Key` (gehasht in agent_api_keys).
// Doel: één consistente, valideerbare buitenlaag voor ClickWise / Voice / WhatsApp / SMS / CRM.
// Implementatie: roept intern de bestaande `availability`, `book_reservation` engines aan,
// en doet voor update/cancel directe DB writes binnen restaurant_id van de sleutel.
// Geen tweede reserveringsengine — alle echte logica blijft in de bestaande functies.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders as baseCors } from "../_shared/cors.ts";
import {
  zonedDateTimeToUtcIso, addMinutesIso, intervalsOverlap, ACTIVE_STATUSES,
  findAvailableCombination,
} from "../_shared/reservation-utils.ts";
import { evaluatePacing, type PacingReservation } from "../_shared/pacing.ts";
import { durationMinutesFor } from "../_shared/duration.ts";
import { mapInternalError, twError, twHttp, type TwCode } from "../_shared/tw-errors.ts";
import { logIntegration, actionFromPath } from "../_shared/integration-log.ts";

const corsHeaders = {
  ...baseCors,
  "Access-Control-Allow-Headers":
    (baseCors as Record<string, string>)["Access-Control-Allow-Headers"] +
    ", x-tablewise-api-key, X-TableWise-Api-Key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errResp(code: TwCode, field?: string, customMessage?: string): Response {
  return jsonResp(twError(code, field, customMessage), twHttp(code));
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type KeyRow = {
  id: string;
  restaurant_id: string;
  scopes: string[];
  revoked_at: string | null;
  provider: string | null;
};

async function authenticate(req: Request): Promise<{ keyRow?: KeyRow; errorCode?: TwCode }> {
  const key =
    req.headers.get("x-tablewise-api-key") ||
    req.headers.get("X-TableWise-Api-Key") ||
    // Fallback: accepteer ook de oude voice-agent header zodat klanten 1 sleutel kunnen gebruiken.
    req.headers.get("x-agent-api-key") ||
    "";
  if (!key) return { errorCode: "TW_401_AUTH_MISSING" };
  const hash = await sha256Hex(key);
  const sb = admin();
  const { data, error } = await sb
    .from("agent_api_keys")
    .select("id, restaurant_id, scopes, revoked_at, provider")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !data) return { errorCode: "TW_401_AUTH_INVALID" };
  if (data.revoked_at) return { errorCode: "TW_401_AUTH_INVALID" };
  // Touch last_used_at (best effort)
  sb.from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});
  return { keyRow: data as KeyRow };
}

async function callInternal(name: string, body: unknown): Promise<{ status: number; body: any }> {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { status: res.status, body: parsed };
}

// --- Validatie helpers --------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function validateDateTime(localDate: string | undefined, localTime: string | undefined): TwCode | null {
  if (!localDate) return "TW_400_MISSING_DATE";
  if (!DATE_RE.test(localDate)) return "TW_400_INVALID_DATE";
  if (!localTime) return "TW_400_MISSING_TIME";
  if (!TIME_RE.test(localTime)) return "TW_400_INVALID_TIME";
  return null;
}

function splitFullName(full: string): { first_name: string; last_name?: string } {
  const trimmed = full.trim().replace(/\s+/g, " ");
  if (!trimmed) return { first_name: "" };
  const idx = trimmed.lastIndexOf(" ");
  if (idx === -1) return { first_name: trimmed };
  return { first_name: trimmed.slice(0, idx), last_name: trimmed.slice(idx + 1) };
}

// Externe `source` → interne reservation_channel enum.
function mapSourceToChannel(source: string | undefined): string {
  switch ((source || "").toLowerCase()) {
    case "voice_agent":
    case "phone_ai":
    case "vapi":
    case "retell":
    case "highlevel":      return "ai_host";
    case "whatsapp":
    case "sms":
    case "webchat":
    case "clickwise":      return "clickwise";
    case "phone":
    case "manual_phone":   return "phone";
    case "walk_in":        return "walk_in";
    case "manager":
    case "staff_entry":    return "manager";
    case "import":         return "import";
    default:               return "online";
  }
}

// Bouw publieke links voor self/update/cancel + guest-manage page.
function buildLinks(req: Request, reservationId: string, manageToken?: string | null, restaurantSlug?: string | null) {
  const base = `${SUPABASE_URL}/functions/v1/public_api/reservations/${reservationId}`;
  const origin = req.headers.get("origin") || "https://txtablewise.lovable.app";
  const slugPart = restaurantSlug ? `/${restaurantSlug}` : "";
  return {
    self: base,
    update: base,
    cancel: base,
    guestManage: manageToken ? `${origin}/r${slugPart}/manage/${manageToken}` : null,
  };
}

// --- Router -------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.indexOf("public_api");
  const tail = idx >= 0 ? segments.slice(idx + 1) : segments;
  const resource = tail[0] || "";
  const resId = tail[1];

  // Capture body once for logging (handlers re-parse via clone).
  let rawBody: any = undefined;
  if (req.method !== "GET" && req.method !== "OPTIONS") {
    try { rawBody = await req.clone().json(); } catch { rawBody = undefined; }
  }
  const apiKeyHeader = req.headers.get("X-TableWise-Api-Key") || req.headers.get("x-tablewise-api-key") || "";
  const apiKeyPrefix = apiKeyHeader ? apiKeyHeader.slice(0, 12) : null;

  // Action mapping for logging.
  const action =
    resource === "availability" ? "check_availability"
    : resource === "reservation-request" ? "create_reservation"
    : resource === "reservations"
      ? (req.method === "POST" ? "create_reservation"
        : req.method === "PATCH" ? "update_reservation"
        : req.method === "DELETE" ? "cancel_reservation"
        : "other")
      : actionFromPath(url.pathname);

  // Auth
  const auth = await authenticate(req);
  if (auth.errorCode || !auth.keyRow) {
    const resp = errResp(auth.errorCode || "TW_401_AUTH_INVALID");
    // We have no restaurantId here — skip log (auth-failure logging would leak to wrong tenant).
    return resp;
  }
  const keyRow = auth.keyRow;

  let response: Response;
  let respBodyForLog: any = undefined;
  let reservationIdForLog: string | null = (resId && resource === "reservations") ? resId : null;

  try {
    if (resource === "availability") {
      if (req.method !== "POST") response = errResp("TW_405_METHOD_NOT_ALLOWED");
      else response = await handleAvailability(req, keyRow);
    } else if (resource === "reservation-request") {
      // Ultra-simple endpoint for AI Voice / ClickWise: check availability + book in one call.
      if (req.method !== "POST") response = errResp("TW_405_METHOD_NOT_ALLOWED");
      else response = await handleReservationRequest(req, keyRow);
    } else if (resource === "reservations") {
      if (req.method === "POST" && !resId) response = await handleCreateReservation(req, keyRow);
      else if (req.method === "PATCH" && resId) response = await handleUpdateReservation(req, keyRow, resId);
      else if (req.method === "DELETE" && resId) response = await handleCancelReservation(req, keyRow, resId);
      else response = errResp("TW_405_METHOD_NOT_ALLOWED");
    } else {
      response = errResp("TW_405_METHOD_NOT_ALLOWED", undefined, `Onbekend endpoint '/public_api/${resource}'.`);
    }
  } catch (e) {
    console.error("public_api error", e);
    response = errResp("TW_500_INTERNAL", undefined, e instanceof Error ? e.message : undefined);
  }

  // Read response body for logging without consuming the original.
  try {
    const cloned = response.clone();
    respBodyForLog = await cloned.json();
    if (respBodyForLog?.reservationId) reservationIdForLog = respBodyForLog.reservationId;
  } catch { /* not json — skip */ }

  const status = response.status;
  const isSuccess = status >= 200 && status < 300;
  const errBlock = respBodyForLog?.error;

  logIntegration({
    restaurantId: keyRow.restaurant_id,
    source: "api",
    action,
    status: isSuccess ? "success" : "failed",
    httpStatus: status,
    latencyMs: Date.now() - startedAt,
    errorCode: errBlock?.code ?? null,
    errorMessage: errBlock?.message ?? null,
    requestPayload: rawBody,
    responsePayload: respBodyForLog,
    reservationId: reservationIdForLog,
    apiKeyPrefix,
    externalReference: rawBody?.externalReference ?? null,
    metadata: { method: req.method, path: url.pathname, key_id: keyRow.id, provider: keyRow.provider ?? null },
  });

  return response;
});

// --- Availability -------------------------------------------------------------

async function handleAvailability(req: Request, keyRow: KeyRow): Promise<Response> {
  if (!keyRow.scopes.includes("availability")) return errResp("TW_403_SCOPE_MISSING", "availability");

  let body: any;
  try { body = await req.json(); } catch { return errResp("TW_400_INVALID_BODY"); }

  const { restaurantId, locationId, localDate, localTime, partySize } = body || {};

  // Tenant-check
  const requestedRestaurant = restaurantId || locationId;
  if (requestedRestaurant && requestedRestaurant !== keyRow.restaurant_id) {
    return errResp("TW_403_TENANT_MISMATCH", "locationId");
  }

  const dtErr = validateDateTime(localDate, localTime);
  if (dtErr) return errResp(dtErr, dtErr.includes("DATE") ? "localDate" : "localTime");
  if (!partySize || typeof partySize !== "number" || partySize < 1) {
    return errResp("TW_400_MISSING_PARTY_SIZE", "partySize");
  }

  const internal = await callInternal("availability", {
    restaurant_id: keyRow.restaurant_id,
    date: localDate,
    party_size: partySize,
  });

  if (internal.status >= 400) {
    return errResp(mapInternalError(internal.body?.error_code), undefined, internal.body?.error);
  }

  const data = internal.body || {};

  // Closed?
  if (data.closed) {
    return jsonResp({
      isAvailable: false,
      isAvailableWithWaitlist: false,
      requestedSlot: { localDate, localTime, available: false },
      availableSlots: [],
      suggestedAlternatives: [],
      reason: "TW_423_RESTAURANT_CLOSED",
    });
  }
  // Large group block from internal
  if (data.large_group) {
    return jsonResp({
      isAvailable: false,
      isAvailableWithWaitlist: false,
      requestedSlot: { localDate, localTime, available: false },
      availableSlots: [],
      suggestedAlternatives: [],
      reason: "TW_409_PARTY_TOO_LARGE",
    });
  }

  const slots: Array<{ time: string; available: boolean; peak_warning?: boolean; reason?: string }> = data.slots || [];
  const requested = slots.find((s) => s.time === localTime);

  // Find nearest alternatives (3 voor en 3 na requested time)
  const reqMinutes = toMinutes(localTime);
  const availableSorted = slots
    .filter((s) => s.available && s.time !== localTime)
    .sort((a, b) => Math.abs(toMinutes(a.time) - reqMinutes) - Math.abs(toMinutes(b.time) - reqMinutes));
  const alternatives = availableSorted.slice(0, 6).map((s) => ({
    localTime: s.time,
    peakWarning: !!s.peak_warning,
  }));

  let reason: string | null = null;
  if (!requested) reason = "TW_423_RESTAURANT_CLOSED";
  else if (!requested.available) {
    reason = requested.reason === "no_table" ? "TW_409_TIMESLOT_UNAVAILABLE" : "TW_409_PACING_FULL";
  }

  return jsonResp({
    isAvailable: !!requested?.available,
    isAvailableWithWaitlist: !requested?.available && alternatives.length === 0,
    requestedSlot: {
      localDate,
      localTime,
      available: !!requested?.available,
      peakWarning: !!requested?.peak_warning,
    },
    availableSlots: slots.filter((s) => s.available).map((s) => ({
      localTime: s.time,
      available: true,
      peakWarning: !!s.peak_warning,
    })),
    suggestedAlternatives: alternatives,
    reason,
  });
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// --- Create reservation -------------------------------------------------------

async function handleCreateReservation(req: Request, keyRow: KeyRow): Promise<Response> {
  if (!keyRow.scopes.includes("book")) return errResp("TW_403_SCOPE_MISSING", "book");

  let body: any;
  try { body = await req.json(); } catch { return errResp("TW_400_INVALID_BODY"); }

  const {
    restaurantId, locationId,
    localDate, localTime, partySize,
    contact, notes, language, source, externalReference,
  } = body || {};

  const requestedRestaurant = restaurantId || locationId;
  if (requestedRestaurant && requestedRestaurant !== keyRow.restaurant_id) {
    return errResp("TW_403_TENANT_MISMATCH", "locationId");
  }

  // Validatie velden
  const dtErr = validateDateTime(localDate, localTime);
  if (dtErr) return errResp(dtErr, dtErr.includes("DATE") ? "localDate" : "localTime");
  if (!partySize || typeof partySize !== "number" || partySize < 1) {
    return errResp("TW_400_MISSING_PARTY_SIZE", "partySize");
  }

  // Datum in verleden?
  // We doen een ruwe check: combineer date+time as UTC schatting (de exacte tz-check gebeurt in book_reservation),
  // maar voor "duidelijk in verleden" (dag eerder) failen we vroeg.
  const todayIso = new Date().toISOString().slice(0, 10);
  if (localDate < todayIso) return errResp("TW_400_DATE_IN_PAST", "localDate");

  // Contact
  const c = contact || {};
  let firstName: string | undefined = c.firstName;
  let lastName: string | undefined = c.lastName;
  if (!firstName && c.fullName) {
    const parts = splitFullName(String(c.fullName));
    firstName = parts.first_name;
    lastName = parts.last_name;
  }
  if (!firstName) return errResp("TW_400_MISSING_NAME", "contact.fullName");
  if (!c.phone) return errResp("TW_400_MISSING_PHONE", "contact.phone");
  if (!PHONE_RE.test(String(c.phone))) return errResp("TW_400_INVALID_PHONE", "contact.phone");
  if (c.email && !EMAIL_RE.test(String(c.email))) return errResp("TW_400_INVALID_EMAIL", "contact.email");

  const emailProvided = !!c.email;
  // book_reservation vereist email (regex). Genereer een neutrale placeholder als niet meegegeven.
  // Markeer dit in source_metadata zodat operators / CRM dit kunnen herkennen.
  const guestEmail = emailProvided
    ? String(c.email)
    : `noemail+${keyRow.restaurant_id.slice(0, 8)}-${Date.now()}@public.tablewise.local`;

  // Duplicate-detectie (5 min): zelfde restaurant + datum + tijd ± 5 min + zelfde phone of email.
  const sb = admin();
  try {
    const start = `${localDate}T${localTime}:00`;
    const startDate = new Date(zonedDateTimeToUtcIso(localDate, localTime, "Europe/Amsterdam"));
    const lo = new Date(startDate.getTime() - 5 * 60_000).toISOString();
    const hi = new Date(startDate.getTime() + 5 * 60_000).toISOString();
    const { data: dup } = await sb
      .from("reservations")
      .select("id, guest:guests(phone, email)")
      .eq("restaurant_id", keyRow.restaurant_id)
      .gte("start_time", lo).lte("start_time", hi)
      .in("status", ACTIVE_STATUSES as unknown as string[])
      .limit(20);
    const phoneNorm = String(c.phone).replace(/\s+/g, "");
    const dupHit = (dup ?? []).find((r: any) => {
      const g = r.guest;
      if (!g) return false;
      if (emailProvided && g.email && g.email.toLowerCase() === String(c.email).toLowerCase()) return true;
      if (g.phone && String(g.phone).replace(/\s+/g, "") === phoneNorm) return true;
      return false;
    });
    if (dupHit) {
      return errResp("TW_409_POSSIBLE_DUPLICATE", undefined,
        "Er bestaat al een reservering voor deze gast rond dit tijdstip. Voeg 'externalReference' toe of wijzig de bestaande reservering.");
    }
    void start;
  } catch (e) {
    console.warn("public_api duplicate-check failed (non-fatal)", e);
  }

  const channel = mapSourceToChannel(source);

  const internalPayload = {
    restaurant_id: keyRow.restaurant_id,
    date: localDate,
    time: localTime,
    party_size: partySize,
    guest: {
      first_name: firstName,
      last_name: lastName,
      phone: c.phone,
      email: guestEmail,
      language: language || c.language || "nl",
    },
    special_requests: notes ?? null,
    channel,
    source_metadata: {
      via: "public_api",
      source: source || null,
      external_reference: externalReference || null,
      email_provided: emailProvided,
      api_key_id: keyRow.id,
      provider: keyRow.provider || null,
    },
  };

  const internal = await callInternal("book_reservation", internalPayload);

  if (internal.status >= 400) {
    const tw = mapInternalError(internal.body?.error_code);
    return errResp(tw, internal.body?.field, internal.body?.error);
  }

  const r = internal.body?.reservation;
  if (!r) return errResp("TW_500_INTERNAL");

  // Persist external_reference op de reservering (book_reservation slaat dit nu nog niet als topfield op).
  if (externalReference) {
    await sb.from("reservations").update({ external_reference: String(externalReference) }).eq("id", r.id);
  }

  // Haal manage_token op voor guestManage link
  const { data: full } = await sb
    .from("reservations")
    .select("manage_token, guest:guests(first_name, last_name, phone, email), restaurant:restaurants(slug)")
    .eq("id", r.id).maybeSingle();

  const guest = full?.guest as any;
  const restSlug = (full?.restaurant as any)?.slug ?? null;
  const fullName = [guest?.first_name, guest?.last_name].filter(Boolean).join(" ").trim();

  return jsonResp({
    status: r.status,
    reservationId: r.id,
    reservationCode: r.confirmation_code,
    localDate,
    localTime,
    partySize,
    guest: {
      fullName: fullName || null,
      phone: guest?.phone || null,
      email: emailProvided ? guest?.email || null : null,
    },
    links: buildLinks(req, r.id, full?.manage_token, restSlug),
  }, 201);
}

// --- Reservation request (ultra-simple AI Voice / ClickWise endpoint) --------
//
// POST /public_api/reservation-request
// Eén call die intern: valideert → availability checkt → boekt.
// Bij vol: retourneert TW_409_TIMESLOT_UNAVAILABLE met `suggestedAlternatives`
// zodat de AI Voice agent meteen alternatieven kan voorlezen.
//
// Payload:
// {
//   "localDate": "YYYY-MM-DD", "localTime": "HH:mm", "partySize": 4,
//   "notes": "optioneel",
//   "source": "clickwise_voice" | "voice_agent" | "phone_ai" | ...,
//   "contact": { "fullName": "...", "phone": "+316...", "email": "optioneel", "language": "nl" }
// }
async function handleReservationRequest(req: Request, keyRow: KeyRow): Promise<Response> {
  if (!keyRow.scopes.includes("book")) return errResp("TW_403_SCOPE_MISSING", "book");

  let body: any;
  try { body = await req.json(); } catch { return errResp("TW_400_INVALID_BODY"); }

  const { localDate, localTime, partySize, notes, source, externalReference } = body || {};
  const c = body?.contact || {};

  // Validatie
  const dtErr = validateDateTime(localDate, localTime);
  if (dtErr) return errResp(dtErr, dtErr.includes("DATE") ? "localDate" : "localTime");
  if (!partySize || typeof partySize !== "number" || partySize < 1) {
    return errResp("TW_400_MISSING_PARTY_SIZE", "partySize");
  }
  const todayIso = new Date().toISOString().slice(0, 10);
  if (localDate < todayIso) return errResp("TW_400_DATE_IN_PAST", "localDate");

  // Naam
  let firstName: string | undefined = c.firstName;
  let lastName: string | undefined = c.lastName;
  if (!firstName && c.fullName) {
    const parts = splitFullName(String(c.fullName));
    firstName = parts.first_name;
    lastName = parts.last_name;
  }
  if (!firstName) return errResp("TW_400_MISSING_NAME", "contact.fullName");

  // Contact: telefoon OF email verplicht
  const hasPhone = !!c.phone;
  const hasEmail = !!c.email;
  if (!hasPhone && !hasEmail) return errResp("TW_400_MISSING_CONTACT", "contact");
  if (hasPhone && !PHONE_RE.test(String(c.phone))) return errResp("TW_400_INVALID_PHONE", "contact.phone");
  if (hasEmail && !EMAIL_RE.test(String(c.email))) return errResp("TW_400_INVALID_EMAIL", "contact.email");

  // Stap 1: availability check + alternatieven verzamelen
  const availResp = await callInternal("availability", {
    restaurant_id: keyRow.restaurant_id,
    date: localDate,
    party_size: partySize,
  });

  if (availResp.status >= 400) {
    return errResp(mapInternalError(availResp.body?.error_code), undefined, availResp.body?.error);
  }

  const availData = availResp.body || {};
  if (availData.closed) return errResp("TW_423_RESTAURANT_CLOSED", "localDate");
  if (availData.large_group) return errResp("TW_409_PARTY_TOO_LARGE", "partySize");

  const slots: Array<{ time: string; available: boolean; peak_warning?: boolean; reason?: string }> = availData.slots || [];
  const requested = slots.find((s) => s.time === localTime);

  if (!requested?.available) {
    // Bouw 3 dichtstbijzijnde alternatieven
    const reqMinutes = toMinutes(localTime);
    const alts = slots
      .filter((s) => s.available && s.time !== localTime)
      .sort((a, b) => Math.abs(toMinutes(a.time) - reqMinutes) - Math.abs(toMinutes(b.time) - reqMinutes))
      .slice(0, 3)
      .map((s) => ({ localTime: s.time, peakWarning: !!s.peak_warning }));

    const code: TwCode = !requested
      ? "TW_423_RESTAURANT_CLOSED"
      : (requested.reason === "no_table" ? "TW_409_TIMESLOT_UNAVAILABLE" : "TW_409_PACING_FULL");

    const baseError = twError(code, "localTime");
    const suggestedFix = alts.length > 0
      ? `Bied de gast een alternatief tijdstip aan: ${alts.map((a) => a.localTime).join(", ")}.`
      : `Geen alternatieven binnen deze dag. Vraag de gast voor een andere datum.`;

    return jsonResp({
      error: { ...baseError.error, suggestedFix },
      suggestedAlternatives: alts,
    }, twHttp(code));
  }

  // Stap 2: boek via book_reservation
  const guestEmail = hasEmail
    ? String(c.email)
    : `noemail+${keyRow.restaurant_id.slice(0, 8)}-${Date.now()}@public.tablewise.local`;

  const channel = mapSourceToChannel(source);

  const internalPayload = {
    restaurant_id: keyRow.restaurant_id,
    date: localDate,
    time: localTime,
    party_size: partySize,
    guest: {
      first_name: firstName,
      last_name: lastName,
      phone: c.phone || null,
      email: guestEmail,
      language: c.language || "nl",
    },
    special_requests: notes ?? null,
    channel,
    source_metadata: {
      via: "public_api/reservation-request",
      source: source || null,
      external_reference: externalReference || null,
      email_provided: hasEmail,
      phone_provided: hasPhone,
      api_key_id: keyRow.id,
      provider: keyRow.provider || null,
    },
  };

  const internal = await callInternal("book_reservation", internalPayload);
  if (internal.status >= 400) {
    const tw = mapInternalError(internal.body?.error_code);
    return errResp(tw, internal.body?.field, internal.body?.error);
  }

  const r = internal.body?.reservation;
  if (!r) return errResp("TW_500_INTERNAL");

  if (externalReference) {
    const sb = admin();
    await sb.from("reservations").update({ external_reference: String(externalReference) }).eq("id", r.id);
  }

  return jsonResp({
    success: true,
    reservationId: r.id,
    reservationCode: r.confirmation_code,
    status: r.status,
    localDate,
    localTime,
    partySize,
    guest: {
      fullName: [firstName, lastName].filter(Boolean).join(" "),
      phone: hasPhone ? c.phone : null,
      email: hasEmail ? c.email : null,
    },
  }, 201);
}

// --- Update reservation -------------------------------------------------------

async function handleUpdateReservation(req: Request, keyRow: KeyRow, reservationId: string): Promise<Response> {
  // Reuse book scope; aparte 'update' scope is nice-to-have. Voor backwards-compat: 'book' volstaat.
  if (!keyRow.scopes.includes("book") && !keyRow.scopes.includes("update")) {
    return errResp("TW_403_SCOPE_MISSING", "update");
  }

  let body: any = {};
  try { if (req.headers.get("content-length") !== "0") body = await req.json(); } catch { return errResp("TW_400_INVALID_BODY"); }

  const sb = admin();
  const { data: current, error } = await sb
    .from("reservations")
    .select("*, reservation_tables(table_id), guest:guests(*)")
    .eq("id", reservationId)
    .eq("restaurant_id", keyRow.restaurant_id)
    .maybeSingle();
  if (error) return errResp("TW_500_INTERNAL", undefined, error.message);
  if (!current) return errResp("TW_404_RESERVATION_NOT_FOUND", "reservationId");

  if (["cancelled", "completed", "no_show"].includes(current.status)) {
    return errResp("TW_422_RESERVATION_NOT_VALID", "status");
  }

  const { data: restaurant } = await sb
    .from("restaurants").select("*").eq("id", current.restaurant_id).maybeSingle();
  if (!restaurant) return errResp("TW_404_RESTAURANT_NOT_FOUND");

  const tz: string = restaurant.timezone || "Europe/Amsterdam";

  const newDate = body.localDate as string | undefined;
  const newTime = body.localTime as string | undefined;
  const newParty = body.partySize as number | undefined;
  const newNotes = body.notes as string | undefined;
  const newContact = body.contact as any | undefined;

  // Format checks (alleen als meegegeven)
  if (newDate && !DATE_RE.test(newDate)) return errResp("TW_400_INVALID_DATE", "localDate");
  if (newTime && !TIME_RE.test(newTime)) return errResp("TW_400_INVALID_TIME", "localTime");
  if (newParty !== undefined && (typeof newParty !== "number" || newParty < 1)) {
    return errResp("TW_400_MISSING_PARTY_SIZE", "partySize");
  }
  if (newContact?.phone && !PHONE_RE.test(String(newContact.phone))) return errResp("TW_400_INVALID_PHONE", "contact.phone");
  if (newContact?.email && !EMAIL_RE.test(String(newContact.email))) return errResp("TW_400_INVALID_EMAIL", "contact.email");

  // Tijdwijziging?
  const wantsTimeShift = !!(newDate || newTime || (newParty !== undefined && newParty !== current.party_size));
  const patch: Record<string, any> = {};

  if (wantsTimeShift) {
    const finalDate = newDate || current.reservation_date;
    const finalTime = newTime || new Date(current.start_time).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz });
    const finalParty = newParty ?? current.party_size;

    const durationMinutes = durationMinutesFor(finalParty, restaurant);

    const start_iso = zonedDateTimeToUtcIso(finalDate, finalTime, tz);
    const end_iso = addMinutesIso(start_iso, durationMinutes);

    if (new Date(start_iso) < new Date(Date.now() + (restaurant.booking_lead_time_minutes ?? 0) * 60_000)) {
      return errResp("TW_400_DATE_IN_PAST", "localTime");
    }

    // Pacing check voor het nieuwe tijdslot (excludeert huidige reservering)
    const { data: existingForPacing } = await sb
      .from("reservations")
      .select("id, start_time, end_time, party_size, status, hold_expires_at")
      .eq("restaurant_id", restaurant.id)
      .gte("start_time", addMinutesIso(start_iso, -durationMinutes))
      .lte("start_time", addMinutesIso(end_iso, durationMinutes))
      .in("status", ACTIVE_STATUSES as unknown as string[]);
    const pacingRows: PacingReservation[] = (existingForPacing ?? []).map((r: any) => ({
      id: r.id, start_time: r.start_time, end_time: r.end_time,
      party_size: r.party_size ?? 0, status: r.status, hold_expires_at: r.hold_expires_at,
    }));
    const pacing = evaluatePacing(
      { start_iso, end_iso, party_size: finalParty },
      pacingRows,
      {
        max_covers_per_slot: restaurant.max_covers_per_slot ?? null,
        max_new_reservations_per_15min: restaurant.max_new_reservations_per_15min ?? null,
        peak_warning_threshold_pct: restaurant.peak_warning_threshold_pct ?? 85,
      },
      current.id,
    );
    if (!pacing.ok) return errResp("TW_409_TIMESLOT_UNAVAILABLE", "localTime");

    // Conflict-check: zelfde tafel(s) vrij?
    const currentTableIds: string[] = (current.reservation_tables ?? []).map((rt: any) => rt.table_id);

    if (currentTableIds.length > 0) {
      // Check of huidige tafel(s) capaciteit dekken voor (eventueel) nieuwe party_size
      const { data: tableRows } = await sb
        .from("tables").select("id, capacity_min, capacity_max")
        .in("id", currentTableIds);
      const totalMax = (tableRows ?? []).reduce((a, t: any) => a + (t.capacity_max ?? 0), 0);
      const totalMin = (tableRows ?? []).reduce((a, t: any) => a + (t.capacity_min ?? 0), 0);
      if (finalParty < totalMin || finalParty > totalMax) {
        // Probeer een passende vrije tafel te vinden
        const newTable = await findFreeTable(sb, restaurant.id, finalParty, start_iso, end_iso, current.id);
        if (newTable) {
          await sb.from("reservation_tables").delete().eq("reservation_id", current.id);
          await sb.from("reservation_tables").insert({ reservation_id: current.id, table_id: newTable });
          patch.table_combination_id = null;
        } else {
          const combo = await findAvailableCombination(sb, restaurant.id, finalParty, start_iso, end_iso, current.id);
          if (!combo) return errResp("TW_409_TIMESLOT_UNAVAILABLE", "partySize");
          await sb.from("reservation_tables").delete().eq("reservation_id", current.id);
          await sb.from("reservation_tables").insert(combo.tableIds.map((tid) => ({ reservation_id: current.id, table_id: tid })));
          patch.table_combination_id = combo.combinationId;
        }
      } else {
        // Zelfde tafel houden — check vrije slot
        const conflict = await tableHasConflict(sb, currentTableIds, start_iso, end_iso, current.id);
        if (conflict) {
          const newTable = await findFreeTable(sb, restaurant.id, finalParty, start_iso, end_iso, current.id);
          if (newTable) {
            await sb.from("reservation_tables").delete().eq("reservation_id", current.id);
            await sb.from("reservation_tables").insert({ reservation_id: current.id, table_id: newTable });
            patch.table_combination_id = null;
          } else {
            const combo = await findAvailableCombination(sb, restaurant.id, finalParty, start_iso, end_iso, current.id);
            if (!combo) return errResp("TW_409_TIMESLOT_UNAVAILABLE", "localTime");
            await sb.from("reservation_tables").delete().eq("reservation_id", current.id);
            await sb.from("reservation_tables").insert(combo.tableIds.map((tid) => ({ reservation_id: current.id, table_id: tid })));
            patch.table_combination_id = combo.combinationId;
          }
        }
      }
    } else {
      const newTable = await findFreeTable(sb, restaurant.id, finalParty, start_iso, end_iso, current.id);
      if (newTable) {
        await sb.from("reservation_tables").insert({ reservation_id: current.id, table_id: newTable });
        patch.table_combination_id = null;
      } else {
        const combo = await findAvailableCombination(sb, restaurant.id, finalParty, start_iso, end_iso, current.id);
        if (!combo) return errResp("TW_409_TIMESLOT_UNAVAILABLE", "localTime");
        await sb.from("reservation_tables").insert(combo.tableIds.map((tid) => ({ reservation_id: current.id, table_id: tid })));
        patch.table_combination_id = combo.combinationId;
      }
    }

    patch.reservation_date = finalDate;
    patch.start_time = start_iso;
    patch.end_time = end_iso;
    patch.party_size = finalParty;
  }

  if (newNotes !== undefined) patch.special_requests = newNotes;

  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await sb.from("reservations").update(patch).eq("id", current.id);
    if (updErr) return errResp("TW_500_INTERNAL", undefined, updErr.message);

    // Audit log
    await sb.from("audit_log").insert({
      restaurant_id: keyRow.restaurant_id,
      action: "reservation.updated",
      entity: "reservation",
      entity_id: current.id,
      actor_user_id: null,
      actor_label: `public_api:${keyRow.id.slice(0, 8)}`,
      before_data: {
        reservation_date: current.reservation_date,
        start_time: current.start_time,
        end_time: current.end_time,
        party_size: current.party_size,
        status: current.status,
      },
      after_data: { via: "public_api", changes: patch },
    });
  }

  // Contact-update via guests-tabel
  if (newContact && current.guest_id) {
    const guestPatch: Record<string, any> = {};
    if (newContact.phone) guestPatch.phone = newContact.phone;
    if (newContact.email) guestPatch.email = newContact.email;
    if (newContact.fullName) {
      const p = splitFullName(String(newContact.fullName));
      guestPatch.first_name = p.first_name;
      if (p.last_name) guestPatch.last_name = p.last_name;
    }
    if (newContact.firstName) guestPatch.first_name = newContact.firstName;
    if (newContact.lastName) guestPatch.last_name = newContact.lastName;
    if (Object.keys(guestPatch).length > 0) {
      await sb.from("guests").update(guestPatch).eq("id", current.guest_id);
    }
  }

  // Emit integration event
  await sb.from("integration_events").insert({
    restaurant_id: keyRow.restaurant_id,
    event_type: "reservation.updated",
    target: "clickwise",
    payload: { reservation_id: current.id, via: "public_api", patch },
  });

  // Return current state
  const { data: refreshed } = await sb
    .from("reservations")
    .select("id, status, confirmation_code, reservation_date, start_time, party_size, manage_token, guest:guests(first_name, last_name, phone, email)")
    .eq("id", current.id).maybeSingle();

  const guest = refreshed?.guest as any;
  const tzNow = restaurant.timezone || "Europe/Amsterdam";
  const localTimeOut = refreshed
    ? new Date(refreshed.start_time).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tzNow })
    : null;

  return jsonResp({
    status: refreshed?.status,
    reservationId: refreshed?.id,
    reservationCode: refreshed?.confirmation_code,
    localDate: refreshed?.reservation_date,
    localTime: localTimeOut,
    partySize: refreshed?.party_size,
    guest: {
      fullName: [guest?.first_name, guest?.last_name].filter(Boolean).join(" ").trim() || null,
      phone: guest?.phone || null,
      email: guest?.email || null,
    },
    links: buildLinks(req, current.id, refreshed?.manage_token),
  });
}

async function findFreeTable(sb: any, restaurantId: string, partySize: number, startIso: string, endIso: string, excludeReservationId: string): Promise<string | null> {
  const { data: tables } = await sb
    .from("tables").select("id, capacity_min, capacity_max")
    .eq("restaurant_id", restaurantId).eq("is_active", true)
    .lte("capacity_min", partySize).gte("capacity_max", partySize)
    .order("capacity_max", { ascending: true });
  if (!tables || tables.length === 0) return null;

  const { data: existing } = await sb
    .from("reservations")
    .select("id, start_time, end_time, status, hold_expires_at, reservation_tables(table_id)")
    .eq("restaurant_id", restaurantId)
    .gte("start_time", addMinutesIso(startIso, -240))
    .lte("start_time", addMinutesIso(endIso, 240))
    .in("status", ACTIVE_STATUSES as unknown as string[]);

  const now = new Date();
  const occupied = new Set<string>();
  for (const r of (existing ?? [])) {
    if (r.id === excludeReservationId) continue;
    if (r.status === "hold" && (!r.hold_expires_at || new Date(r.hold_expires_at) <= now)) continue;
    if (intervalsOverlap(startIso, endIso, r.start_time, r.end_time)) {
      for (const rt of (r.reservation_tables ?? [])) occupied.add(rt.table_id);
    }
  }
  const candidate = tables.find((t: any) => !occupied.has(t.id));
  return candidate?.id ?? null;
}

async function tableHasConflict(sb: any, tableIds: string[], startIso: string, endIso: string, excludeReservationId: string): Promise<boolean> {
  const { data } = await sb
    .from("reservation_tables")
    .select("reservation_id, reservations!inner(start_time, end_time, status, hold_expires_at)")
    .in("table_id", tableIds);
  const now = new Date();
  return ((data ?? []) as any[]).some((row) => {
    if (row.reservation_id === excludeReservationId) return false;
    const r = row.reservations;
    if (!r || !ACTIVE_STATUSES.includes(r.status)) return false;
    if (r.status === "hold" && (!r.hold_expires_at || new Date(r.hold_expires_at) <= now)) return false;
    return intervalsOverlap(startIso, endIso, r.start_time, r.end_time);
  });
}

// --- Cancel reservation -------------------------------------------------------

async function handleCancelReservation(req: Request, keyRow: KeyRow, reservationId: string): Promise<Response> {
  if (!keyRow.scopes.includes("cancel")) return errResp("TW_403_SCOPE_MISSING", "cancel");

  const url = new URL(req.url);
  let reason = url.searchParams.get("reason") || undefined;
  if (!reason && req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
    try {
      const body = await req.json();
      reason = body?.reason;
    } catch { /* ignore */ }
  }

  const sb = admin();
  const { data: current, error: fErr } = await sb
    .from("reservations")
    .select("id, status")
    .eq("id", reservationId)
    .eq("restaurant_id", keyRow.restaurant_id)
    .maybeSingle();
  if (fErr) return errResp("TW_500_INTERNAL", undefined, fErr.message);
  if (!current) return errResp("TW_404_RESERVATION_NOT_FOUND", "reservationId");
  if (["cancelled", "completed", "no_show"].includes(current.status)) {
    return errResp("TW_422_RESERVATION_NOT_VALID", "status");
  }

  const { error: uErr } = await sb.from("reservations").update({
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason || "Geannuleerd via public API",
  }).eq("id", reservationId);
  if (uErr) return errResp("TW_500_INTERNAL", undefined, uErr.message);

  await sb.from("integration_events").insert({
    restaurant_id: keyRow.restaurant_id,
    event_type: "reservation.cancelled",
    target: "clickwise",
    payload: { reservation_id: reservationId, via: "public_api", reason: reason || null },
  });

  return jsonResp({
    status: "cancelled",
    reservationId,
    reason: reason || null,
  });
}
