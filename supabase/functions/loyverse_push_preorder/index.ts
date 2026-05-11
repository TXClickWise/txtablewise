// loyverse_push_preorder — pusht pre-order drankjes als open ticket naar Loyverse.
// Twee modi:
//   scheduled: cron-aanroep zonder auth, scant alle restaurants
//   manual:    UI-aanroep met auth + manager check, één reservation_id
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOYVERSE_API = "https://api.loyverse.com/v1.0";

type PushConfig = {
  enabled?: boolean;
  minutes_before?: number;
  dining_option_id?: string | null;
  store_id?: string | null;
};

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

async function logIntegration(
  restaurantId: string,
  reservationId: string | null,
  status: "success" | "error",
  request: unknown,
  response: unknown,
  errorMessage?: string,
) {
  await admin().from("integration_logs").insert({
    restaurant_id: restaurantId,
    reservation_id: reservationId,
    source: "loyverse",
    action: "push_preorder",
    status,
    request_payload: request as never,
    response_payload: response as never,
    error_message: errorMessage ?? null,
    retry_safe: status === "error",
    metadata: {},
  } as never);
}

async function pushOne(
  restaurantId: string,
  reservationId: string,
): Promise<{ ok: boolean; receipt_id?: string; error?: string; skipped?: string }> {
  const sb = admin();

  // 1. Reservation + restaurant + push config
  const { data: res, error: resErr } = await sb
    .from("reservations")
    .select("id, restaurant_id, start_time, status, party_size, guest_id, pos_preorder_pushed_at, guests:guest_id(first_name,last_name,full_name)")
    .eq("id", reservationId)
    .maybeSingle();
  if (resErr || !res) return { ok: false, error: resErr?.message ?? "reservation not found" };
  if (res.restaurant_id !== restaurantId) return { ok: false, error: "restaurant mismatch" };
  if (res.pos_preorder_pushed_at) return { ok: false, skipped: "already_pushed" };
  if (["cancelled", "no_show", "completed"].includes(String(res.status))) {
    return { ok: false, skipped: "status_blocks_push" };
  }

  // 2. Connection
  const { data: conn } = await sb
    .from("pos_connections")
    .select("id, status, access_token_encrypted, config, external_account_id")
    .eq("restaurant_id", restaurantId)
    .eq("provider", "loyverse")
    .maybeSingle();
  if (!conn || conn.status !== "connected") {
    return { ok: false, skipped: "not_connected" };
  }
  const cfg = ((conn.config as Record<string, unknown>)?.push_preorders ?? {}) as PushConfig;
  if (!cfg.enabled) return { ok: false, skipped: "push_disabled" };
  const token = conn.access_token_encrypted as string | null;
  if (!token) return { ok: false, error: "no token" };

  // 3. Pre-order lines
  const { data: lines } = await sb
    .from("pre_orders")
    .select("quantity, unit_price_cents, item_name, pre_order_item_id, pre_order_items:pre_order_item_id(external_product_id, pos_provider, metadata, name)")
    .eq("reservation_id", reservationId);
  if (!lines || lines.length === 0) return { ok: false, skipped: "no_preorders" };

  // Build Loyverse line items — only items synced from Loyverse can be referenced by variant_id
  const lineItems: Array<Record<string, unknown>> = [];
  const unmappedNames: string[] = [];
  for (const l of lines as Array<Record<string, any>>) {
    const item = l.pre_order_items;
    const variantId = item?.metadata?.loyverse_variant_id || item?.external_product_id;
    if (item?.pos_provider === "loyverse" && variantId) {
      lineItems.push({
        variant_id: String(variantId),
        quantity: l.quantity ?? 1,
        price: (l.unit_price_cents ?? 0) / 100,
      });
    } else {
      unmappedNames.push(`${l.quantity}× ${l.item_name}`);
    }
  }
  if (lineItems.length === 0) {
    return { ok: false, skipped: "no_loyverse_mapped_items" };
  }

  // 4. Build payload
  const guest = (res as any).guests;
  const guestName = guest?.full_name || [guest?.first_name, guest?.last_name].filter(Boolean).join(" ") || "Gast";
  const startStr = new Date(res.start_time as string).toLocaleTimeString("nl-NL", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam",
  });
  const noteParts = [`Pre-order — ${guestName} · ${res.party_size}p · ${startStr}`];
  if (unmappedNames.length > 0) noteParts.push(`Niet gemapt: ${unmappedNames.join(", ")}`);

  const payload: Record<string, unknown> = {
    line_items: lineItems,
    note: noteParts.join(" | "),
    payments: [],
  };
  if (cfg.store_id) payload.store_id = cfg.store_id;
  if (cfg.dining_option_id) payload.dining_option_id = cfg.dining_option_id;

  // 5. POST to Loyverse
  let responseBody: unknown = null;
  try {
    const r = await fetch(`${LOYVERSE_API}/receipts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    try { responseBody = JSON.parse(text); } catch { responseBody = text; }
    if (!r.ok) {
      await logIntegration(restaurantId, reservationId, "error", payload, responseBody, `HTTP ${r.status}`);
      await sb.from("reservations").update({ pos_preorder_status: "failed" }).eq("id", reservationId);
      return { ok: false, error: `Loyverse HTTP ${r.status}` };
    }
  } catch (e) {
    const msg = (e as Error).message;
    await logIntegration(restaurantId, reservationId, "error", payload, null, msg);
    await sb.from("reservations").update({ pos_preorder_status: "failed" }).eq("id", reservationId);
    return { ok: false, error: msg };
  }

  const receiptId = (responseBody as Record<string, unknown>)?.receipt_number as string
    || (responseBody as Record<string, unknown>)?.id as string
    || null;

  // 6. Mark pushed
  await sb.from("reservations").update({
    pos_preorder_pushed_at: new Date().toISOString(),
    pos_preorder_receipt_id: receiptId,
    pos_preorder_status: "pushed",
  }).eq("id", reservationId);

  await logIntegration(restaurantId, reservationId, "success", payload, responseBody);
  await sb.from("audit_log").insert({
    restaurant_id: restaurantId,
    entity: "reservation",
    entity_id: reservationId,
    action: "pos.preorder.pushed",
    actor_label: "loyverse_push_preorder",
    after_data: { receipt_id: receiptId, lines: lineItems.length },
  } as never);

  return { ok: true, receipt_id: receiptId ?? undefined };
}

async function scanScheduled(): Promise<{ pushed: number; failed: number; skipped: number; scanned: number }> {
  const sb = admin();
  // Find all restaurants with push enabled
  const { data: conns } = await sb
    .from("pos_connections")
    .select("restaurant_id, config")
    .eq("provider", "loyverse")
    .eq("status", "connected");

  let pushed = 0, failed = 0, skipped = 0, scanned = 0;
  for (const c of (conns ?? []) as Array<{ restaurant_id: string; config: Record<string, unknown> }>) {
    const cfg = (c.config?.push_preorders ?? {}) as PushConfig;
    if (!cfg.enabled) continue;
    const minutesBefore = Math.max(5, Math.min(180, cfg.minutes_before ?? 30));

    const nowMs = Date.now();
    const windowEnd = new Date(nowMs + minutesBefore * 60_000).toISOString();
    const windowStart = new Date(nowMs - 5 * 60_000).toISOString();

    const { data: candidates } = await sb
      .from("reservations")
      .select("id")
      .eq("restaurant_id", c.restaurant_id)
      .is("pos_preorder_pushed_at", null)
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd)
      .in("status", ["pending", "confirmed", "seated"]);

    for (const cand of (candidates ?? []) as Array<{ id: string }>) {
      scanned++;
      const r = await pushOne(c.restaurant_id, cand.id);
      if (r.ok) pushed++;
      else if (r.skipped) skipped++;
      else failed++;
    }
  }
  return { pushed, failed, skipped, scanned };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode ?? "scheduled";

    if (mode === "scheduled") {
      const result = await scanScheduled();
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "manual") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sb = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
      const userId = userData?.user?.id;
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const reservationId = body?.reservation_id as string | undefined;
      if (!reservationId) {
        return new Response(JSON.stringify({ error: "reservation_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: res } = await admin()
        .from("reservations").select("restaurant_id").eq("id", reservationId).maybeSingle();
      if (!res) {
        return new Response(JSON.stringify({ error: "reservation not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: mem } = await admin()
        .from("restaurant_members").select("role")
        .eq("restaurant_id", (res as { restaurant_id: string }).restaurant_id)
        .eq("user_id", userId).maybeSingle();
      if (!mem || !["owner", "manager"].includes((mem as { role: string }).role)) {
        return new Response(JSON.stringify({ error: "Manager required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Force-retry: clear previous failed state
      await admin().from("reservations").update({
        pos_preorder_pushed_at: null,
        pos_preorder_status: null,
      }).eq("id", reservationId).eq("pos_preorder_status", "failed");

      const result = await pushOne((res as { restaurant_id: string }).restaurant_id, reservationId);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown mode" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
