// Shared helper to log integration events safely from edge functions.
// - Masks PII and secrets before insert.
// - Truncates oversized payloads.
// - Suggests a possible cause based on the error code.
// - Fire-and-forget so request latency is unaffected.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type LogSource =
  | "dashboard" | "widget" | "voice_agent" | "clickwise" | "api" | "webhook" | "other";

export type LogStatus = "success" | "warning" | "failed";

export interface IntegrationLogInput {
  restaurantId: string;
  source: LogSource;
  action: string;
  status: LogStatus;
  httpStatus?: number;
  latencyMs?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestPayload?: unknown;
  responsePayload?: unknown;
  guestId?: string | null;
  reservationId?: string | null;
  apiKeyPrefix?: string | null;
  externalReference?: string | null;
  retrySafe?: boolean;
  metadata?: Record<string, unknown>;
}

const SECRET_KEY_RX = /^(authorization|api[_-]?key|x-tablewise-api-key|x-agent-api-key|password|token|secret|access[_-]?token|refresh[_-]?token|webhook[_-]?secret)$/i;
const PHONE_RX = /(\+?\d[\d\s\-().]{6,}\d)/g;
const EMAIL_RX = /([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi;

function maskPhone(s: string): string {
  return s.replace(PHONE_RX, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 6) return m;
    return digits.slice(0, 3) + "•".repeat(Math.max(0, digits.length - 5)) + digits.slice(-2);
  });
}
function maskEmail(s: string): string {
  return s.replace(EMAIL_RX, (_m, name, domain) => {
    const n = String(name);
    const d = String(domain);
    const head = n.length <= 2 ? n[0] ?? "" : n.slice(0, 2);
    const dotIdx = d.lastIndexOf(".");
    const tld = dotIdx >= 0 ? d.slice(dotIdx) : "";
    return `${head}•••@•••${tld}`;
  });
}
function maskApiKey(s: string): string {
  // tw_xxx... → tw_xxx…
  return s.replace(/\b((?:tw|sk|pk)[_-][A-Za-z0-9-]{8,})/g, (_m, k) => `${String(k).slice(0, 12)}…`);
}

function maskValue(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === "string") return maskApiKey(maskEmail(maskPhone(v)));
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(maskValue);
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (SECRET_KEY_RX.test(k)) {
      out[k] = "***";
    } else if (/^(phone|telephone|tel|mobile|gsm)$/i.test(k) && typeof val === "string") {
      out[k] = maskPhone(val);
    } else if (/^email$/i.test(k) && typeof val === "string") {
      out[k] = maskEmail(val);
    } else {
      out[k] = maskValue(val);
    }
  }
  return out;
}

function truncate(payload: unknown, maxBytes = 8 * 1024): unknown {
  if (payload == null) return payload;
  try {
    const json = JSON.stringify(payload);
    if (json.length <= maxBytes) return payload;
    return { _truncated: true, _bytes: json.length, preview: json.slice(0, maxBytes) };
  } catch {
    return { _unserializable: true };
  }
}

const POSSIBLE_CAUSE_MAP: Record<string, string> = {
  TW_400_MISSING_DATE: "Datum ontbreekt in payload (verwacht localDate: YYYY-MM-DD).",
  TW_400_MISSING_TIME: "Tijd ontbreekt (verwacht localTime: HH:MM).",
  TW_400_MISSING_PARTY_SIZE: "Aantal personen ontbreekt (verwacht partySize: integer).",
  TW_400_INVALID_PHONE: "Telefoonnummer niet in geldig formaat (verwacht +31...).",
  TW_400_INVALID_DATE: "Datum onleesbaar — gebruik YYYY-MM-DD.",
  TW_400_INVALID_TIME: "Tijd onleesbaar — gebruik HH:MM (24u).",
  TW_401_UNAUTHORIZED: "API-sleutel ontbreekt, ongeldig of ingetrokken.",
  TW_403_FORBIDDEN: "Sleutel heeft geen toegang tot deze actie (controleer scopes).",
  TW_404_RESERVATION_NOT_FOUND: "Reservering niet gevonden — controleer reservation id.",
  TW_409_TIMESLOT_UNAVAILABLE: "Tijdslot zit vol — bied alternatief tijdstip of wachtlijst aan.",
  TW_409_PARTY_TOO_LARGE: "Groep is groter dan max online — vereist handmatige goedkeuring.",
  TW_422_RESERVATION_NOT_VALID: "Reservering geweigerd door interne validatie (controleer payload-velden).",
  TW_423_RESTAURANT_CLOSED: "Restaurant is gesloten op dat moment.",
  TW_429_RATE_LIMITED: "Te veel verzoeken in korte tijd.",
  TW_500_INTERNAL: "Interne fout — herhaalt het zich, neem contact op met support.",
};

function derivePossibleCause(input: IntegrationLogInput): string | null {
  if (input.status === "success") return null;
  if (input.errorCode && POSSIBLE_CAUSE_MAP[input.errorCode]) return POSSIBLE_CAUSE_MAP[input.errorCode];
  if (input.source === "webhook") {
    const s = input.httpStatus ?? 0;
    if (s === 0) return "Endpoint onbereikbaar (timeout of DNS-fout).";
    if (s >= 500) return "Endpoint geeft een interne fout — bestemming offline of onstabiel.";
    if (s === 401 || s === 403) return "Endpoint weigert auth — controleer signing secret of credentials.";
    if (s === 404) return "Endpoint bestaat niet (URL controleren).";
    if (s >= 400) return "Endpoint weigert payload — veldmapping klopt waarschijnlijk niet.";
  }
  return input.errorMessage ?? null;
}

function isRetrySafe(input: IntegrationLogInput): boolean {
  if (input.retrySafe) return true;
  if (input.status === "success") return false;
  // Read-only operations are always safe to retry.
  if (input.action === "check_availability") return true;
  // Webhook deliveries are idempotent on our side.
  if (input.action === "webhook_delivery") return true;
  return false;
}

export function logIntegration(input: IntegrationLogInput): void {
  // Fire-and-forget — never await.
  (async () => {
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
      const masked = {
        request_payload: truncate(maskValue(input.requestPayload)),
        response_payload: truncate(maskValue(input.responsePayload)),
      };
      await sb.from("integration_logs").insert({
        restaurant_id: input.restaurantId,
        source: input.source,
        action: input.action,
        status: input.status,
        http_status: input.httpStatus ?? null,
        latency_ms: input.latencyMs ?? null,
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
        possible_cause: derivePossibleCause(input),
        request_payload: masked.request_payload,
        response_payload: masked.response_payload,
        guest_id: input.guestId ?? null,
        reservation_id: input.reservationId ?? null,
        api_key_prefix: input.apiKeyPrefix ?? null,
        external_reference: input.externalReference ?? null,
        retry_safe: isRetrySafe(input),
        metadata: input.metadata ?? {},
      });
    } catch (e) {
      console.error("[integration-log] insert failed", e);
    }
  })();
}

export function actionFromPath(path: string): string {
  const last = path.split("/").filter(Boolean).pop() ?? "other";
  const map: Record<string, string> = {
    availability: "check_availability",
    check_availability: "check_availability",
    reservations: "create_reservation",
    book_reservation: "create_reservation",
    cancel_reservation: "cancel_reservation",
  };
  return map[last] ?? last;
}
