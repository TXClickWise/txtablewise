// Agent API — externe AI voice agents (Vapi, Retell, HighLevel) bellen deze endpoint
// om beschikbaarheid te checken, te boeken of te annuleren via TableWise.
//
// Auth: header X-Agent-Api-Key. Sleutel wordt vergeleken met sha-256 hash in agent_api_keys.
// Routes (POST):
//   /agent_api/check_availability
//   /agent_api/book_reservation
//   /agent_api/cancel_reservation
//   /agent_api/log_call           (provider stuurt afronding van gesprek)
//
// Geen JWT vereist (zie config.toml). Validatie gebeurt server-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders as baseCors } from "../_shared/cors.ts";

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

async function callInternalFn(name: string, body: unknown) {
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
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  // path is /agent_api/<action> when invoked via /functions/v1/agent_api/<action>
  const segments = url.pathname.split("/").filter(Boolean);
  const action = segments[segments.length - 1] || "";

  if (req.method !== "POST") return json({ error: "Method not allowed", error_code: "method_not_allowed" }, 405);

  const auth = await authenticate(req);
  if ("error" in auth) return json({ error: auth.error, error_code: auth.error_code }, auth.status);
  const { keyRow } = auth;

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) ?? {};
  } catch {
    return json({ error: "Invalid JSON body", error_code: "invalid_json" }, 400);
  }

  // Force restaurant_id to the one the key belongs to (prevents cross-tenant)
  payload.restaurant_id = keyRow.restaurant_id;

  const sb = admin();

  try {
    switch (action) {
      case "check_availability": {
        if (!keyRow.scopes.includes("availability")) return json({ error: "Scope missing: availability", error_code: "auth_scope_missing", field: "availability" }, 403);
        const { date, party_size } = payload as { date?: string; party_size?: number };
        if (!date) return json({ error: "date required (YYYY-MM-DD)", error_code: "missing_field", field: "date" }, 400);
        if (!party_size) return json({ error: "party_size required", error_code: "missing_field", field: "party_size" }, 400);
        const r = await callInternalFn("availability", {
          restaurant_id: keyRow.restaurant_id,
          date,
          party_size,
        });
        return json(r.body, r.status);
      }

      case "book_reservation": {
        if (!keyRow.scopes.includes("book")) return json({ error: "Scope missing: book", error_code: "auth_scope_missing", field: "book" }, 403);
        const required = ["date", "time", "party_size", "guest"];
        for (const k of required) {
          if (!(k in payload)) return json({ error: `Missing field: ${k}`, error_code: "missing_field", field: k }, 400);
        }
        const guest = payload.guest as Record<string, unknown> | undefined;
        if (!guest?.first_name) return json({ error: "guest.first_name required", error_code: "missing_field", field: "guest.first_name" }, 400);
        // Voice-agents leveren niet altijd e-mail — gebruik placeholder als ontbreekt
        if (!guest.email) {
          guest.email = `voice-${Date.now()}@tablewise.local`;
        }
        const bookBody = {
          ...payload,
          channel: "ai_host",
          source_metadata: {
            ...(payload.source_metadata as object | undefined),
            agent_provider: keyRow.provider,
            via: "agent_api",
          },
        };
        const r = await callInternalFn("book_reservation", bookBody);
        return json(r.body, r.status);
      }

      case "cancel_reservation": {
        if (!keyRow.scopes.includes("cancel")) return json({ error: "Scope missing: cancel", error_code: "auth_scope_missing", field: "cancel" }, 403);
        const { reservation_id, manage_token, reason } = payload as {
          reservation_id?: string;
          manage_token?: string;
          reason?: string;
        };
        if (!reservation_id && !manage_token) {
          return json({ error: "reservation_id or manage_token required", error_code: "missing_field", field: "reservation_id" }, 400);
        }
        // Direct DB update — beperkt tot eigen restaurant
        let q = sb.from("reservations").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || "Geannuleerd via voice-agent",
        });
        if (reservation_id) {
          q = q.eq("id", reservation_id).eq("restaurant_id", keyRow.restaurant_id);
        } else if (manage_token) {
          q = q.eq("manage_token", manage_token).eq("restaurant_id", keyRow.restaurant_id);
        }
        const { data, error } = await q.select("id").maybeSingle();
        if (error) return json({ error: error.message, error_code: "internal" }, 400);
        if (!data) return json({ error: "Reservation not found", error_code: "not_found", field: "reservation_id" }, 404);
        return json({ ok: true, reservation_id: data.id });
      }

      case "log_call": {
        const {
          external_call_id,
          caller_phone,
          callee_phone,
          outcome,
          reservation_id,
          duration_seconds,
          cost_cents,
          transcript_url,
          summary,
          agent_id,
          metadata,
        } = payload as Record<string, unknown>;
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

      default:
        return json({ error: `Unknown action '${action}'. Use check_availability, book_reservation, cancel_reservation or log_call.`, error_code: "unknown_action", field: "action" }, 404);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg, error_code: "internal" }, 500);
  }
});
