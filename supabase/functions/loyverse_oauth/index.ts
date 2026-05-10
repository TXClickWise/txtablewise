// Loyverse OAuth + sync edge function.
// Actions: authorize_url, callback (browser redirect), disconnect, sync_now, status.
// Redirect URI to register in Loyverse Developer Portal:
//   https://lbhtztbpxmqlzhyephew.supabase.co/functions/v1/loyverse_oauth?action=callback
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const LOYVERSE_AUTH_URL = "https://api.loyverse.com/oauth/authorize";
const LOYVERSE_TOKEN_URL = "https://api.loyverse.com/oauth/token";
const LOYVERSE_API = "https://api.loyverse.com/v1.0";
const SCOPES = "RECEIPTS_READ STORES_READ MERCHANT_READ";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CLIENT_ID = Deno.env.get("LOYVERSE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("LOYVERSE_CLIENT_SECRET") ?? "";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/loyverse_oauth`;
// Frontend return URL after callback finishes (preview or published)
const FRONTEND_FALLBACK = "https://txtablewise.lovable.app/app/integraties/pos";

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

async function getUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await sb.auth.getUser();
  if (error) return null;
  return data?.user?.id ?? null;
}

async function isManager(restaurantId: string, userId: string): Promise<boolean> {
  const { data } = await admin()
    .from("restaurant_members")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data && ["owner", "manager"].includes((data as { role: string }).role);
}

function htmlRedirect(url: string, message: string) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Loyverse</title></head>
<body style="font-family:system-ui;padding:40px;text-align:center">
<h2>${message}</h2><p>Je wordt teruggestuurd…</p>
<script>setTimeout(()=>{window.location.href=${JSON.stringify(url)}},1200)</script></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function logEvent(restaurantId: string, eventType: string, payload: Record<string, unknown>) {
  await admin().from("integration_events").insert({
    restaurant_id: restaurantId, event_type: eventType, target: "pos", payload, status: "processed",
    processed_at: new Date().toISOString(),
  });
}

// ---- Loyverse API helpers ----
async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const r = await fetch(LOYVERSE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`token exchange failed: ${r.status} ${await r.text()}`);
  return await r.json() as { access_token: string; refresh_token: string; expires_in: number; token_type: string };
}

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

async function ensureFreshToken(connection: { id: string; access_token_encrypted: string | null; refresh_token_encrypted: string | null; token_expires_at: string | null }): Promise<string> {
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000 && connection.access_token_encrypted) {
    return connection.access_token_encrypted;
  }
  if (!connection.refresh_token_encrypted) throw new Error("no refresh token");
  const t = await refreshAccessToken(connection.refresh_token_encrypted);
  await admin().from("pos_connections").update({
    access_token_encrypted: t.access_token,
    refresh_token_encrypted: t.refresh_token ?? connection.refresh_token_encrypted,
    token_expires_at: new Date(Date.now() + (t.expires_in - 30) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id);
  return t.access_token;
}

async function loyverseFetch(token: string, path: string, query: Record<string, string> = {}) {
  const url = new URL(LOYVERSE_API + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`loyverse ${path} -> ${r.status} ${await r.text()}`);
  return await r.json();
}

// ---- Sync: pull receipts -> pos_orders ----
async function syncReceipts(restaurantId: string): Promise<{ imported: number; skipped: number }> {
  const a = admin();
  const { data: conn } = await a.from("pos_connections").select("*")
    .eq("restaurant_id", restaurantId).eq("provider", "loyverse").maybeSingle();
  if (!conn) throw new Error("no loyverse connection");
  const c = conn as Record<string, unknown>;
  const token = await ensureFreshToken({
    id: c.id as string,
    access_token_encrypted: (c.access_token_encrypted as string) ?? null,
    refresh_token_encrypted: (c.refresh_token_encrypted as string) ?? null,
    token_expires_at: (c.token_expires_at as string) ?? null,
  });

  const since = c.last_synced_at
    ? new Date(c.last_synced_at as string).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const data = await loyverseFetch(token, "/receipts", { created_at_min: since, limit: "100" }) as { receipts?: Array<Record<string, unknown>> };
  const receipts = data.receipts ?? [];
  let imported = 0, skipped = 0;

  for (const rec of receipts) {
    const externalId = String(rec.receipt_number ?? rec.id ?? "");
    if (!externalId) { skipped++; continue; }
    // dedupe
    const { data: existing } = await a.from("pos_orders").select("id")
      .eq("restaurant_id", restaurantId).eq("provider", "loyverse")
      .eq("external_order_id", externalId).maybeSingle();
    if (existing) { skipped++; continue; }

    const totalCents = Math.round((rec.total_money as number ?? 0) * 100);
    const tipCents = Math.round((rec.tip as number ?? 0) * 100);
    const taxCents = Math.round((rec.total_tax as number ?? 0) * 100);
    const discountCents = Math.round((rec.total_discount as number ?? 0) * 100);

    await a.from("pos_orders").insert({
      restaurant_id: restaurantId,
      pos_connection_id: c.id,
      provider: "loyverse",
      source_type: "loyverse_api",
      external_order_id: externalId,
      external_table_id: (rec.dining_option as string) ?? null,
      total_cents: totalCents,
      tip_cents: tipCents,
      tax_total_cents: taxCents,
      discount_total_cents: discountCents,
      subtotal_cents: Math.max(0, totalCents - taxCents),
      currency: "EUR",
      payment_status: (rec.payments && (rec.payments as unknown[]).length > 0) ? "paid" : "open",
      matching_status: "unmatched",
      receipt_created_at: (rec.created_at as string) ?? null,
      closed_at: (rec.receipt_date as string) ?? null,
      imported_at: new Date().toISOString(),
      metadata: { store_id: rec.store_id, receipt_number: rec.receipt_number, source: (rec.source as string) ?? "loyverse" },
      raw_payload: rec,
    });
    imported++;
  }

  await a.from("pos_connections").update({
    last_synced_at: new Date().toISOString(),
    status: "active",
    last_error: null,
  }).eq("id", c.id as string);

  await logEvent(restaurantId, "pos.sync_completed", { provider: "loyverse", imported, skipped });
  return { imported, skipped };
}

// ---- Main handler ----
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";

  try {
    // ---- BROWSER callback (no JWT, comes from Loyverse) ----
    if ((action === "callback" || (req.method === "GET" && url.searchParams.has("code"))) && req.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const err = url.searchParams.get("error");
      if (err) return htmlRedirect(`${FRONTEND_FALLBACK}?loyverse=error&reason=${encodeURIComponent(err)}`, "Loyverse koppeling afgewezen");
      if (!code || !state) return htmlRedirect(`${FRONTEND_FALLBACK}?loyverse=error&reason=missing_code`, "Loyverse koppeling mislukt");

      // state = base64(restaurantId:nonce)
      let restaurantId = "";
      let nonce = "";
      try {
        const decoded = atob(state);
        [restaurantId, nonce] = decoded.split(":");
      } catch { /* */ }
      if (!restaurantId) return htmlRedirect(`${FRONTEND_FALLBACK}?loyverse=error&reason=bad_state`, "Ongeldige state");

      const a = admin();
      const { data: pending } = await a.from("pos_connections").select("id,config")
        .eq("restaurant_id", restaurantId).eq("provider", "loyverse").maybeSingle();
      const expected = (pending?.config as Record<string, unknown> | null)?.pending_state;
      if (!expected || expected !== nonce) {
        return htmlRedirect(`${FRONTEND_FALLBACK}?loyverse=error&reason=state_mismatch`, "State controle mislukt");
      }

      const tokens = await exchangeCode(code);

      // Lookup merchant info for display_name
      let displayName = "Loyverse account";
      let externalId: string | null = null;
      try {
        const merchant = await loyverseFetch(tokens.access_token, "/merchant") as { name?: string; id?: string; business_name?: string };
        displayName = merchant.business_name ?? merchant.name ?? displayName;
        externalId = merchant.id ?? null;
      } catch { /* non-blocking */ }

      const expiresAt = new Date(Date.now() + (tokens.expires_in - 30) * 1000).toISOString();
      await a.from("pos_connections").update({
        access_token_encrypted: tokens.access_token,
        refresh_token_encrypted: tokens.refresh_token,
        token_expires_at: expiresAt,
        status: "active",
        display_name: displayName,
        external_account_id: externalId,
        last_error: null,
        config: { ...(pending?.config as Record<string, unknown> ?? {}), pending_state: null, connected_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq("id", pending!.id);

      await logEvent(restaurantId, "pos.connection_established", { provider: "loyverse", display_name: displayName });
      return htmlRedirect(`${FRONTEND_FALLBACK}?loyverse=connected`, "Loyverse gekoppeld!");
    }

    // ---- AUTH-required actions ----
    const userId = await getUserId(req.headers.get("Authorization"));
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "loyverse credentials not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const restaurantId = (body.restaurant_id as string) ?? url.searchParams.get("restaurant_id") ?? "";
    if (!restaurantId) return new Response(JSON.stringify({ error: "restaurant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!(await isManager(restaurantId, userId))) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const a = admin();

    if (action === "authorize_url") {
      const nonce = crypto.randomUUID();
      const state = btoa(`${restaurantId}:${nonce}`);

      // upsert pending connection
      const { data: existing } = await a.from("pos_connections").select("id,config")
        .eq("restaurant_id", restaurantId).eq("provider", "loyverse").maybeSingle();
      if (existing) {
        await a.from("pos_connections").update({
          status: "pending",
          config: { ...(existing.config as Record<string, unknown> ?? {}), pending_state: nonce },
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await a.from("pos_connections").insert({
          restaurant_id: restaurantId, provider: "loyverse", status: "pending",
          config: { pending_state: nonce },
        });
      }

      const authUrl = new URL(LOYVERSE_AUTH_URL);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", CLIENT_ID);
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      authUrl.searchParams.set("state", state);

      return new Response(JSON.stringify({ url: authUrl.toString(), redirect_uri: REDIRECT_URI }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { data } = await a.from("pos_connections").select("id,status,display_name,last_synced_at,last_error,token_expires_at,external_account_id,created_at")
        .eq("restaurant_id", restaurantId).eq("provider", "loyverse").maybeSingle();
      return new Response(JSON.stringify({ connection: data ?? null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "sync_now") {
      const r = await syncReceipts(restaurantId);
      return new Response(JSON.stringify({ ok: true, ...r }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "disconnect") {
      await a.from("pos_connections").update({
        status: "disabled",
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("restaurant_id", restaurantId).eq("provider", "loyverse");
      await logEvent(restaurantId, "pos.connection_disconnected", { provider: "loyverse" });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("loyverse_oauth error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
