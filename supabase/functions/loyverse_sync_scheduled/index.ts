// Cron-scheduled Loyverse sync — iterates all active connections.
// Triggered by pg_cron via HTTP. No JWT (verify_jwt = false), uses service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("LOYVERSE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("LOYVERSE_CLIENT_SECRET") ?? "";
const LOYVERSE_API = "https://api.loyverse.com/v1.0";
const LOYVERSE_TOKEN_URL = "https://api.loyverse.com/oauth/token";

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const r = await fetch(LOYVERSE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`refresh failed: ${r.status} ${await r.text()}`);
  return await r.json() as { access_token: string; refresh_token?: string; expires_in: number };
}

async function loyverseFetch(token: string, path: string, query: Record<string, string> = {}) {
  const url = new URL(LOYVERSE_API + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`loyverse ${path} -> ${r.status} ${await r.text()}`);
  return await r.json();
}

async function syncOne(admin: ReturnType<typeof createClient>, conn: Record<string, unknown>) {
  let access = conn.access_token_encrypted as string | null;
  const refresh = conn.refresh_token_encrypted as string | null;
  const cfg = (conn.config ?? {}) as Record<string, unknown>;
  const authMethod = (cfg.auth_method as string) ?? (refresh ? "oauth" : "personal_token");
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at as string).getTime() : 0;

  if (authMethod === "oauth") {
    if (!refresh) throw new Error("no refresh token");
    if (!access || expiresAt < Date.now() + 60_000) {
      const t = await refreshAccessToken(refresh);
      access = t.access_token;
      await admin.from("pos_connections").update({
        access_token_encrypted: t.access_token,
        refresh_token_encrypted: t.refresh_token ?? refresh,
        token_expires_at: new Date(Date.now() + (t.expires_in - 30) * 1000).toISOString(),
      }).eq("id", conn.id as string);
    }
  } else {
    // personal_token — token does not expire; just ensure we have one
    if (!access) throw new Error("no access token");
  }

  const since = conn.last_synced_at
    ? new Date(conn.last_synced_at as string).toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const data = await loyverseFetch(access!, "/receipts", { created_at_min: since, limit: "100" }) as { receipts?: Array<Record<string, unknown>> };
  const receipts = data.receipts ?? [];
  const restaurantId = conn.restaurant_id as string;
  let imported = 0;

  for (const rec of receipts) {
    const externalId = String(rec.receipt_number ?? rec.id ?? "");
    if (!externalId) continue;
    const { data: existing } = await admin.from("pos_orders").select("id")
      .eq("restaurant_id", restaurantId).eq("provider", "loyverse")
      .eq("external_order_id", externalId).maybeSingle();
    if (existing) continue;

    const totalCents = Math.round((rec.total_money as number ?? 0) * 100);
    const taxCents = Math.round((rec.total_tax as number ?? 0) * 100);
    await admin.from("pos_orders").insert({
      restaurant_id: restaurantId,
      pos_connection_id: conn.id,
      provider: "loyverse",
      source_type: "loyverse_api",
      external_order_id: externalId,
      total_cents: totalCents,
      tip_cents: Math.round((rec.tip as number ?? 0) * 100),
      tax_total_cents: taxCents,
      discount_total_cents: Math.round((rec.total_discount as number ?? 0) * 100),
      subtotal_cents: Math.max(0, totalCents - taxCents),
      currency: "EUR",
      payment_status: (rec.payments && (rec.payments as unknown[]).length > 0) ? "paid" : "open",
      matching_status: "unmatched",
      receipt_created_at: (rec.created_at as string) ?? null,
      closed_at: (rec.receipt_date as string) ?? null,
      imported_at: new Date().toISOString(),
      metadata: { store_id: rec.store_id, receipt_number: rec.receipt_number },
      raw_payload: rec,
    });
    imported++;
  }

  await admin.from("pos_connections").update({
    last_synced_at: new Date().toISOString(),
    status: "active",
    last_error: null,
  }).eq("id", conn.id as string);

  return { restaurant_id: restaurantId, imported };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: "loyverse credentials missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: conns, error } = await admin.from("pos_connections").select("*")
    .eq("provider", "loyverse").eq("status", "active");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: Array<{ restaurant_id: string; imported?: number; error?: string }> = [];
  for (const c of (conns ?? []) as Record<string, unknown>[]) {
    try {
      const r = await syncOne(admin, c);
      results.push(r);
    } catch (e) {
      const msg = (e as Error).message;
      await admin.from("pos_connections").update({ last_error: msg }).eq("id", c.id as string);
      results.push({ restaurant_id: c.restaurant_id as string, error: msg });
    }
  }

  return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
