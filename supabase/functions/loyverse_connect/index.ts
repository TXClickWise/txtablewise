// Loyverse Personal Access Token connect/sync function.
// Replaces the OAuth flow with a simpler "paste your token" model.
// Actions: connect, status, disconnect, sync_now
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOYVERSE_API = "https://api.loyverse.com/v1.0";

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

async function logEvent(restaurantId: string, eventType: string, payload: Record<string, unknown>) {
  await admin().from("integration_events").insert({
    restaurant_id: restaurantId,
    event_type: eventType,
    target: "pos",
    payload,
    status: "processed",
    processed_at: new Date().toISOString(),
  });
}

async function loyverseFetch(token: string, path: string, query: Record<string, string> = {}) {
  const url = new URL(LOYVERSE_API + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error(`loyverse ${path} -> ${r.status} ${text}`) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  try { return JSON.parse(text); } catch { return {}; }
}

function statusView(conn: Record<string, unknown> | null) {
  if (!conn) return null;
  return {
    id: conn.id,
    status: conn.status,
    display_name: conn.display_name,
    last_synced_at: conn.last_synced_at,
    last_error: conn.last_error,
    token_expires_at: null,
    external_account_id: conn.external_account_id,
    created_at: conn.created_at,
  };
}

async function syncReceipts(restaurantId: string, conn: Record<string, unknown>): Promise<{ imported: number; skipped: number }> {
  const token = conn.access_token_encrypted as string | null;
  if (!token) throw new Error("no access token");

  const since = conn.last_synced_at
    ? new Date(conn.last_synced_at as string).toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const data = await loyverseFetch(token, "/receipts", { created_at_min: since, limit: "100" }) as { receipts?: Array<Record<string, unknown>> };
  const receipts = data.receipts ?? [];
  let imported = 0;
  let skipped = 0;

  for (const rec of receipts) {
    const externalId = String(rec.receipt_number ?? rec.id ?? "");
    if (!externalId) { skipped++; continue; }
    const { data: existing } = await admin().from("pos_orders").select("id")
      .eq("restaurant_id", restaurantId).eq("provider", "loyverse")
      .eq("external_order_id", externalId).maybeSingle();
    if (existing) { skipped++; continue; }

    const totalCents = Math.round(Number(rec.total_money ?? 0) * 100);
    const taxCents = Math.round(Number(rec.total_tax ?? 0) * 100);
    await admin().from("pos_orders").insert({
      restaurant_id: restaurantId,
      pos_connection_id: conn.id,
      provider: "loyverse",
      source_type: "loyverse_api",
      external_order_id: externalId,
      total_cents: totalCents,
      tip_cents: Math.round(Number(rec.tip ?? 0) * 100),
      tax_total_cents: taxCents,
      discount_total_cents: Math.round(Number(rec.total_discount ?? 0) * 100),
      subtotal_cents: Math.max(0, totalCents - taxCents),
      currency: "EUR",
      payment_status: Array.isArray(rec.payments) && (rec.payments as unknown[]).length > 0 ? "paid" : "open",
      matching_status: "unmatched",
      receipt_created_at: (rec.created_at as string) ?? null,
      closed_at: (rec.receipt_date as string) ?? null,
      imported_at: new Date().toISOString(),
      metadata: { store_id: rec.store_id, receipt_number: rec.receipt_number },
      raw_payload: rec,
    });
    imported++;
  }

  await admin().from("pos_connections").update({
    last_synced_at: new Date().toISOString(),
    status: "active",
    last_error: null,
  }).eq("id", conn.id as string);

  return { imported, skipped };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getUserId(req.headers.get("Authorization"));
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const restaurantId = String(body.restaurant_id ?? "");
    if (!restaurantId) {
      return new Response(JSON.stringify({ error: "restaurant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!(await isManager(restaurantId, userId))) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── status ──────────────────────────────────────────────
    if (action === "status") {
      const { data } = await admin().from("pos_connections").select("*")
        .eq("restaurant_id", restaurantId).eq("provider", "loyverse")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return new Response(JSON.stringify({ connection: statusView(data) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── connect (validate token + save) ─────────────────────
    if (action === "connect") {
      const token = String(body.access_token ?? "").trim();
      if (token.length < 10) {
        return new Response(JSON.stringify({ error: "invalid_token", message: "Token lijkt ongeldig." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate by calling /merchant
      let merchant: Record<string, unknown> = {};
      try {
        merchant = await loyverseFetch(token, "/merchant") as Record<string, unknown>;
      } catch (e) {
        const status = (e as { status?: number }).status ?? 0;
        const message = status === 401
          ? "Token niet geldig. Controleer of je de juiste access token uit Loyverse hebt gekopieerd."
          : `Loyverse weigerde de verbinding (${status}).`;
        return new Response(JSON.stringify({ error: "validation_failed", message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const displayName = String(merchant.business_name ?? merchant.name ?? "Loyverse");
      const externalAccountId = String(merchant.id ?? "");

      // Upsert: one connection per (restaurant, provider)
      const { data: existing } = await admin().from("pos_connections").select("id")
        .eq("restaurant_id", restaurantId).eq("provider", "loyverse").maybeSingle();

      const payload = {
        restaurant_id: restaurantId,
        provider: "loyverse",
        status: "active",
        display_name: displayName,
        external_account_id: externalAccountId || null,
        access_token_encrypted: token,
        refresh_token_encrypted: null,
        token_expires_at: null,
        last_error: null,
        config: { auth_method: "personal_token" },
      };

      if (existing) {
        await admin().from("pos_connections").update(payload).eq("id", (existing as { id: string }).id);
      } else {
        await admin().from("pos_connections").insert(payload);
      }

      await logEvent(restaurantId, "pos.loyverse.connected", { method: "personal_token", merchant: displayName });

      const { data: fresh } = await admin().from("pos_connections").select("*")
        .eq("restaurant_id", restaurantId).eq("provider", "loyverse").maybeSingle();
      return new Response(JSON.stringify({ ok: true, connection: statusView(fresh) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── disconnect ──────────────────────────────────────────
    if (action === "disconnect") {
      await admin().from("pos_connections").update({
        status: "revoked",
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
      }).eq("restaurant_id", restaurantId).eq("provider", "loyverse");
      await logEvent(restaurantId, "pos.loyverse.disconnected", {});
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── sync_now ────────────────────────────────────────────
    if (action === "sync_now") {
      const { data: conn } = await admin().from("pos_connections").select("*")
        .eq("restaurant_id", restaurantId).eq("provider", "loyverse")
        .eq("status", "active").maybeSingle();
      if (!conn) {
        return new Response(JSON.stringify({ error: "not_connected" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const r = await syncReceipts(restaurantId, conn as Record<string, unknown>);
        await logEvent(restaurantId, "pos.loyverse.sync", r);
        return new Response(JSON.stringify({ ok: true, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        const msg = (e as Error).message;
        await admin().from("pos_connections").update({ last_error: msg })
          .eq("id", (conn as { id: string }).id);
        return new Response(JSON.stringify({ error: "sync_failed", message: msg }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal_error", message: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
