// Webhook dispatcher — sends queued integration_events to configured webhook URLs.
// Can be invoked manually, by cron, or by client after status changes.
// Uses HMAC-SHA256 signature header for verification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 25;

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

    // Cache restaurant config
    const restCache = new Map<string, { webhook_url: string | null; webhook_secret: string | null }>();
    const getRest = async (id: string) => {
      if (restCache.has(id)) return restCache.get(id)!;
      const { data } = await supabase.from("restaurants").select("webhook_url, webhook_secret").eq("id", id).maybeSingle();
      const cfg = { webhook_url: data?.webhook_url ?? null, webhook_secret: data?.webhook_secret ?? null };
      restCache.set(id, cfg);
      return cfg;
    };

    let dispatched = 0;
    let failed = 0;
    let skipped = 0;

    for (const ev of events) {
      const cfg = await getRest(ev.restaurant_id);
      if (!cfg.webhook_url) {
        // No webhook configured: mark as skipped (delivered to no-op)
        await supabase.from("integration_events")
          .update({ status: "delivered", last_error: "no webhook_url configured" })
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

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-TableWise-Event": ev.event_type,
        "X-TableWise-Event-Id": ev.id,
      };

      if (cfg.webhook_secret) {
        headers["X-TableWise-Signature"] = await sign(body, cfg.webhook_secret);
      }

      try {
        const resp = await fetch(cfg.webhook_url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (resp.ok) {
          await supabase.from("integration_events")
            .update({ status: "delivered", attempts: ev.attempts + 1, last_error: null })
            .eq("id", ev.id);
          dispatched++;
        } else {
          const txt = await resp.text().catch(() => "");
          const newAttempts = ev.attempts + 1;
          await supabase.from("integration_events").update({
            status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
            attempts: newAttempts,
            last_error: `HTTP ${resp.status}: ${txt.slice(0, 200)}`,
          }).eq("id", ev.id);
          failed++;
        }
      } catch (e) {
        const newAttempts = ev.attempts + 1;
        await supabase.from("integration_events").update({
          status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts: newAttempts,
          last_error: e instanceof Error ? e.message.slice(0, 200) : "fetch error",
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
