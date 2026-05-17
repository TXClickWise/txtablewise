// Webhook dispatcher — sends queued integration_events to configured webhook URLs.
// Supports multiple endpoints per restaurant (webhook_endpoints table) with per-endpoint
// event filter. Falls back to the legacy single restaurants.webhook_url for restaurants
// that haven't migrated to multi-endpoints yet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { logIntegration } from "../_shared/integration-log.ts";

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
    let restaurantFilter = url.searchParams.get("restaurant_id");
    // Sta ook JSON body toe (supabase.functions.invoke gebruikt body, geen query params).
    if (!restaurantFilter && (req.method === "POST" || req.method === "PUT")) {
      try {
        const body = await req.json();
        if (body && typeof body.restaurant_id === "string") {
          restaurantFilter = body.restaurant_id;
        }
      } catch (_) { /* geen body, prima */ }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();
    let q = supabase.from("integration_events")
      .select("*")
      .eq("status", "pending")
      .lt("attempts", MAX_ATTEMPTS)
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
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

    // Cache restaurant base info per restaurant_id for URL building
    const restaurantCache = new Map<string, { slug: string | null; timezone: string | null; public_base_url: string | null; name: string | null }>();
    const getRestaurant = async (id: string) => {
      if (restaurantCache.has(id)) return restaurantCache.get(id)!;
      const { data } = await supabase
        .from("restaurants")
        .select("slug, timezone, public_base_url, name")
        .eq("id", id)
        .maybeSingle();
      const r = {
        slug: (data?.slug as string | null) ?? null,
        timezone: (data?.timezone as string | null) ?? "Europe/Amsterdam",
        public_base_url: (data?.public_base_url as string | null) ?? null,
        name: (data?.name as string | null) ?? null,
      };
      restaurantCache.set(id, r);
      return r;
    };

    // Enrich payload with reservation_date / reservation_time / manage_token / manage_url / cancel_url
    // so ClickWise workflows have everything in one place under inboundWebhookRequest.payload.*
    const SITE_URL = (Deno.env.get("SITE_URL") || "https://www.txtablewise.nl").replace(/\/+$/, "");
    const enrichPayload = async (
      restaurantId: string,
      payload: Record<string, unknown> | null,
      entityType: string | null,
      entityId: string | null,
    ): Promise<Record<string, unknown>> => {
      const out: Record<string, unknown> = { ...(payload ?? {}) };
      const reservationId: string | undefined =
        (typeof out.reservation_id === "string" ? out.reservation_id : undefined) ??
        (entityType === "reservation" && entityId ? entityId : undefined);
      if (!reservationId) return out;

      const { data: res } = await supabase
        .from("reservations")
        .select("id, reservation_date, start_time, end_time, party_size, status, manage_token, cancel_token, confirmation_code, guest_first_name, guest_last_name, guest_email, guest_phone, special_requests, occasion, guests:guest_id(first_name,last_name,email,phone,language)")
        .eq("id", reservationId)
        .maybeSingle();
      if (!res) return out;

      const rest = await getRestaurant(restaurantId);
      const tz = rest.timezone || "Europe/Amsterdam";
      // HH:MM in restaurant timezone
      let reservation_time: string | null = null;
      try {
        const fmt = new Intl.DateTimeFormat("nl-NL", {
          hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
        });
        reservation_time = fmt.format(new Date(res.start_time as string));
      } catch { /* ignore */ }

      const base = (rest.public_base_url || SITE_URL).replace(/\/+$/, "");
      const slugPart = rest.slug ? `/${rest.slug}` : "";
      const manageUrl = res.manage_token
        ? `${base}/r${slugPart}/manage/${res.manage_token}` : null;
      const cancelUrl = res.cancel_token
        ? `${base}/r${slugPart}/manage/${res.cancel_token}?action=cancel` : null;
      const confirmUrl = res.manage_token
        ? `${base}/r${slugPart}/manage/${res.manage_token}?action=confirm` : null;

      const g = (res.guests as { first_name?: string; last_name?: string; email?: string; phone?: string; language?: string } | null) ?? null;
      const guest = {
        first_name: g?.first_name ?? res.guest_first_name ?? null,
        last_name: g?.last_name ?? res.guest_last_name ?? null,
        email: g?.email ?? res.guest_email ?? null,
        phone: g?.phone ?? res.guest_phone ?? null,
        language: g?.language ?? null,
      };

      // Top-level enriched fields — additive, never overwrite existing keys
      const defaults: Record<string, unknown> = {
        reservation_id: res.id,
        reservation_date: res.reservation_date,
        reservation_time,
        start_time: res.start_time,
        end_time: res.end_time,
        party_size: res.party_size,
        status: res.status,
        manage_token: res.manage_token,
        cancel_token: res.cancel_token,
        confirmation_code: res.confirmation_code,
        manage_url: manageUrl,
        cancel_url: cancelUrl,
        confirm_url: confirmUrl,
        special_requests: res.special_requests,
        occasion: res.occasion,
        guest,
        reservation: {
          id: res.id,
          date: res.reservation_date,
          time: reservation_time,
          start_time: res.start_time,
          end_time: res.end_time,
          party_size: res.party_size,
          status: res.status,
          manage_token: res.manage_token,
          cancel_token: res.cancel_token,
          confirmation_code: res.confirmation_code,
          manage_url: manageUrl,
          cancel_url: cancelUrl,
          confirm_url: confirmUrl,
          guest,
        },
        restaurant: {
          id: restaurantId,
          name: rest.name,
          slug: rest.slug,
          timezone: tz,
        },
      };
      for (const [k, v] of Object.entries(defaults)) {
        if (!(k in out) || out[k] == null) out[k] = v;
      }
      return out;
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
          .update({ status: "skipped", last_error: "no matching webhook endpoint", processed_at: new Date().toISOString() })
          .eq("id", ev.id);
        skipped++;
        continue;
      }

      const enrichedPayload = await enrichPayload(
        ev.restaurant_id,
        (ev.payload ?? {}) as Record<string, unknown>,
        (ev.entity_type ?? null) as string | null,
        (ev.entity_id ?? null) as string | null,
      );
      const body = JSON.stringify({
        id: ev.id,
        event_type: ev.event_type,
        restaurant_id: ev.restaurant_id,
        created_at: ev.created_at,
        payload: enrichedPayload,
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
          .update({ status: "delivered", attempts: ev.attempts + 1, last_error: null, next_retry_at: null })
          .eq("id", ev.id);
        dispatched++;
      } else {
        const newAttempts = ev.attempts + 1;
        // Exponential backoff: 1m, 2m, 4m, 8m, 16m (capped)
        const backoffMin = Math.min(Math.pow(2, newAttempts - 1), 60);
        const nextRetry = new Date(Date.now() + backoffMin * 60_000).toISOString();
        await supabase.from("integration_events").update({
          status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts: newAttempts,
          last_error: errors.join(" | ").slice(0, 500),
          next_retry_at: newAttempts >= MAX_ATTEMPTS ? null : nextRetry,
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
