// Retry an integration log entry — only when retry_safe = true and action is whitelisted.
// Auth: Supabase user JWT; only restaurant managers can trigger retries.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { logIntegration } from "../_shared/integration-log.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const RETRY_SAFE_ACTIONS = new Set(["check_availability", "webhook_delivery"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "missing_auth" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "invalid_auth" }, 401);

  let body: { logId?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body.logId) return json({ error: "logId required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Fetch log
  const { data: log, error: logErr } = await admin.from("integration_logs").select("*").eq("id", body.logId).maybeSingle();
  if (logErr || !log) return json({ error: "log_not_found" }, 404);

  // Manager check
  const { data: member } = await admin.from("restaurant_members")
    .select("role").eq("restaurant_id", log.restaurant_id).eq("user_id", userData.user.id).maybeSingle();
  if (!member || !["owner", "manager"].includes(member.role)) return json({ error: "not_manager" }, 403);

  if (!log.retry_safe) return json({ error: "not_retry_safe", message: "Deze actie kan niet veilig opnieuw worden uitgevoerd. Maak hem handmatig aan in /app/reservations." }, 400);
  if (!RETRY_SAFE_ACTIONS.has(log.action)) return json({ error: "action_not_retryable", action: log.action }, 400);

  const startedAt = Date.now();

  if (log.action === "webhook_delivery") {
    const reqP = (log.request_payload ?? {}) as any;
    const url = reqP.endpoint_url;
    if (!url) return json({ error: "missing_endpoint_url" }, 400);
    let httpStatus: number | undefined;
    let respText = "";
    let epError: string | null = null;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-TableWise-Retry-Of": log.id },
        body: JSON.stringify({ event_type: reqP.event_type, payload: reqP.payload }),
        signal: AbortSignal.timeout(10_000),
      });
      httpStatus = r.status;
      respText = await r.text().catch(() => "");
      if (!r.ok) epError = `HTTP ${r.status}`;
    } catch (e) {
      epError = e instanceof Error ? e.message : "fetch error";
    }
    logIntegration({
      restaurantId: log.restaurant_id,
      source: "webhook",
      action: "webhook_delivery",
      status: epError ? "failed" : "success",
      httpStatus,
      latencyMs: Date.now() - startedAt,
      errorMessage: epError,
      requestPayload: log.request_payload,
      responsePayload: respText ? { body: respText.slice(0, 2000) } : null,
      retrySafe: true,
      metadata: { retry_of: log.id },
    });
    return json({ ok: !epError, httpStatus, error: epError });
  }

  if (log.action === "check_availability") {
    // Read-only — re-call the availability function with the original payload (sans secrets).
    const reqP = (log.request_payload ?? {}) as any;
    const callBody = {
      restaurant_id: log.restaurant_id,
      date: reqP.localDate ?? reqP.date,
      party_size: reqP.partySize ?? reqP.party_size,
      time: reqP.localTime ?? reqP.time,
    };
    if (!callBody.date || !callBody.party_size) return json({ error: "missing_required_fields" }, 400);

    let httpStatus = 0;
    let respBody: any = null;
    let epError: string | null = null;
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify(callBody),
      });
      httpStatus = r.status;
      respBody = await r.json().catch(() => null);
      if (!r.ok) epError = respBody?.error?.message || `HTTP ${r.status}`;
    } catch (e) {
      epError = e instanceof Error ? e.message : "fetch error";
    }
    logIntegration({
      restaurantId: log.restaurant_id,
      source: "api",
      action: "check_availability",
      status: epError ? "failed" : "success",
      httpStatus,
      latencyMs: Date.now() - startedAt,
      errorMessage: epError,
      requestPayload: callBody,
      responsePayload: respBody,
      metadata: { retry_of: log.id },
    });
    return json({ ok: !epError, httpStatus, response: respBody, error: epError });
  }

  return json({ error: "unsupported" }, 400);
});
