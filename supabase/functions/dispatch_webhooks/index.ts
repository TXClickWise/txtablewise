// Webhook dispatcher — sends queued integration_events to configured webhook URLs.
// Supports multiple endpoints per restaurant (webhook_endpoints table) with per-endpoint
// event filter. Falls back to the legacy single restaurants.webhook_url for restaurants
// that haven't migrated to multi-endpoints yet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 25;

type Endpoint = {
  id?: string;
  url: string;
  secret: string | null;
  events: string[]; // ['*'] = all
  label: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const restaurantFilter = url.searchParams.get("restaurant_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase.from("integration_events")
      .select("*")
      .eq("status", "pending")
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (restaurantFilter) q = q.eq("restaurant_id", restaurantFilter);

    const { data: events, error } = await q;
    if (error) return json({ error: error.message }, 500);

    if (!events || events.length === 0) {
      return json({ ok: true, dispatched: 0 });
    }

    // Cache endpoints per restaurant (multi-endpoint + legacy fallback)
    const endpointCache = new Map<string, Endpoint[]>();
    const getEndpoints = async (id: string): Promise<Endpoint[]> => {
      if (endpointCache.has(id)) return endpointCache.get(id)!;
      const list: Endpoint[] = [];
      const { data: rows } = await supabase
        .from("webhook_endpoints")
        .select("id, url, secret, events, label")
        .eq("restaurant_id", id)
        .eq("is_active", true);
      if (rows && rows.length) {
        for (const r of rows) {
          list.push({
            id: r.id,
            url: r.url,
            secret: r.secret ?? null,
            events: (r.events && r.events.length) ? r.events : ["*"],
            label: r.label ?? "endpoint",
          });
        }
      }
      // Legacy fallback: single restaurants.webhook_url
      if (list.length === 0) {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("webhook_url, webhook_secret")
          .eq("id", id)
          .maybeSingle();
        if (rest?.webhook_url) {
          list.push({
            url: rest.webhook_url,
            secret: rest.webhook_secret ?? null,
            events: ["*"],
            label: "legacy",
          });
        }
      }
      endpointCache.set(id, list);
      return list;
    };

    let dispatched = 0;
    let failed = 0;
    let skipped = 0;

    for (const ev of events) {
      const endpoints = await getEndpoints(ev.restaurant_id);
      // Filter on event type
      const matching = endpoints.filter((e) =>
        e.events.includes("*") || e.events.includes(ev.event_type)
      );

      if (matching.length === 0) {
        await supabase.from("integration_events")
          .update({ status: "delivered", last_error: "no matching webhook endpoint" })
          .eq("id", ev.id);
        skipped++;
        continue;
      }

      const body = JSON.stringify({
        id: ev.id,
        event_type: ev.event_type,
        restaurant_id: ev.restaurant_id,
        created_at: ev.created_at,
        payload: ev.payload,
      });

      // Try every matching endpoint; success if all-ok, fail if any fails (retried by attempts)
      let allOk = true;
      const errors: string[] = [];
      for (const ep of matching) {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-TableWise-Event": ev.event_type,
          "X-TableWise-Event-Id": ev.id,
          "X-TableWise-Endpoint": ep.label,
        };
        if (ep.secret) {
          headers["X-TableWise-Signature"] = await sign(body, ep.secret);
        }
        const epStartedAt = Date.now();
        let httpStatus: number | undefined;
        let respText = "";
        let epError: string | null = null;
        try {
          const resp = await fetch(ep.url, {
            method: "POST",
            headers,
            body,
            signal: AbortSignal.timeout(10_000),
          });
          httpStatus = resp.status;
          respText = await resp.text().catch(() => "");
          if (!resp.ok) {
            epError = `HTTP ${resp.status} ${respText.slice(0, 100)}`;
            errors.push(`${ep.label}: ${epError}`);
            allOk = false;
          }
        } catch (e) {
          epError = e instanceof Error ? e.message.slice(0, 120) : "fetch error";
          errors.push(`${ep.label}: ${epError}`);
          allOk = false;
        }
        // Log this delivery attempt
        logIntegration({
          restaurantId: ev.restaurant_id,
          source: "webhook",
          action: "webhook_delivery",
          status: epError ? "failed" : "success",
          httpStatus,
          latencyMs: Date.now() - epStartedAt,
          errorCode: epError ? `HTTP_${httpStatus ?? "TIMEOUT"}` : null,
          errorMessage: epError,
          requestPayload: { event_type: ev.event_type, payload: ev.payload, endpoint_label: ep.label, endpoint_url: ep.url },
          responsePayload: respText ? { body: respText.slice(0, 2000) } : null,
          retrySafe: true,
          metadata: { event_id: ev.id, attempts: ev.attempts + 1 },
        });
      }

      if (allOk) {
        await supabase.from("integration_events")
          .update({ status: "delivered", attempts: ev.attempts + 1, last_error: null })
          .eq("id", ev.id);
        dispatched++;
      } else {
        const newAttempts = ev.attempts + 1;
        await supabase.from("integration_events").update({
          status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts: newAttempts,
          last_error: errors.join(" | ").slice(0, 500),
        }).eq("id", ev.id);
        failed++;
      }
    }

    return json({ ok: true, dispatched, failed, skipped, total: events.length });
  } catch (e) {
    console.error("dispatch_webhooks error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

async function sign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
