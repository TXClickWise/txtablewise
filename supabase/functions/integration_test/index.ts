// integration_test — server-side helper for the Integratiehub UI test buttons.
// Requires authenticated manager; verifies they are member of the restaurant.
//
// Routes (POST):
//   /integration_test/webhook        body: { endpoint_id, event_type? }
//   /integration_test/availability   body: { date, party_size }
//   /integration_test/book           body: { date, time, party_size, guest:{first_name,last_name?,phone?,email?}, special_requests? }
//
// Notes:
// - Test reservations are written with source_metadata.test = true so they can be
//   filtered out of reporting later if needed.
// - Webhook test sends a sample payload and stores response on webhook_endpoints.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Verify caller is a manager of the restaurant
async function verifyManager(req: Request, restaurantId: string) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return { ok: false, status: 401, error: "Niet ingelogd" };
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return { ok: false, status: 401, error: "Niet ingelogd" };
  const sb = admin();
  const { data: member } = await sb
    .from("restaurant_members")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (!member) return { ok: false, status: 403, error: "Geen toegang tot dit restaurant" };
  if (!["owner", "manager"].includes(member.role)) {
    return { ok: false, status: 403, error: "Manager-rechten vereist" };
  }
  return { ok: true, userId: u.user.id };
}

async function sign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { status: res.status, body: parsed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const action = segments[segments.length - 1] || "";

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) ?? {};
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const sb = admin();

  try {
    // ----- WEBHOOK TEST -----
    if (action === "webhook") {
      const { endpoint_id, event_type, dry_run } = payload as { endpoint_id?: string; event_type?: string; dry_run?: boolean };
      if (!endpoint_id) return json({ error: "endpoint_id verplicht" }, 400);
      const { data: ep } = await sb
        .from("webhook_endpoints")
        .select("*")
        .eq("id", endpoint_id)
        .maybeSingle();
      if (!ep) return json({ error: "Webhook niet gevonden" }, 404);

      const guard = await verifyManager(req, ep.restaurant_id);
      if (!guard.ok) return json({ error: guard.error }, guard.status);

      const sampleType = event_type || "reservation.created";

      // Haal restaurant op voor URL-bouw (slug + public_base_url), spiegelt dispatch_webhooks enrichment.
      const { data: restRow } = await sb
        .from("restaurants")
        .select("id, name, slug, timezone, public_base_url")
        .eq("id", ep.restaurant_id)
        .maybeSingle();
      const SITE_URL = (Deno.env.get("SITE_URL") || "https://www.txtablewise.nl").replace(/\/+$/, "");
      const base = ((restRow?.public_base_url as string | null) || SITE_URL).replace(/\/+$/, "");
      const slugPart = restRow?.slug ? `/${restRow.slug}` : "";
      const manageToken = "test-manage-token";
      const cancelToken = "test-cancel-token";
      const manageUrl = `${base}/r${slugPart}/manage/${manageToken}`;
      const cancelUrl = `${manageUrl}?action=cancel`;
      const confirmUrl = `${manageUrl}?action=confirm`;

      const today = new Date();
      const reservationDate = today.toISOString().slice(0, 10);
      // 19:30 vandaag in ISO (best-effort, niet tz-correct maar prima voor test)
      const startIso = new Date(`${reservationDate}T19:30:00`).toISOString();
      const guest = {
        first_name: "Test",
        last_name: "Webhook",
        phone: "+31600000000",
        email: "test@example.com",
        language: "nl",
      };

      const samplePayload = {
        id: "test-" + crypto.randomUUID(),
        event_type: sampleType,
        restaurant_id: ep.restaurant_id,
        created_at: new Date().toISOString(),
        test: true,
        payload: {
          // Top-level enriched velden — zelfde shape als productie via dispatch_webhooks
          reservation_id: "test-reservation-id",
          reservation_date: reservationDate,
          reservation_time: "19:30",
          start_time: startIso,
          end_time: null,
          party_size: 2,
          status: "confirmed",
          confirmation_code: "TW-TEST",
          manage_token: manageToken,
          cancel_token: cancelToken,
          manage_url: manageUrl,
          cancel_url: cancelUrl,
          confirm_url: confirmUrl,
          special_requests: null,
          occasion: null,
          guest,
          reservation: {
            id: "test-reservation-id",
            date: reservationDate,
            time: "19:30",
            start_time: startIso,
            party_size: 2,
            status: "confirmed",
            confirmation_code: "TW-TEST",
            manage_token: manageToken,
            cancel_token: cancelToken,
            manage_url: manageUrl,
            cancel_url: cancelUrl,
            confirm_url: confirmUrl,
            guest,
          },
          restaurant: {
            id: ep.restaurant_id,
            name: restRow?.name ?? null,
            slug: restRow?.slug ?? null,
            timezone: restRow?.timezone ?? "Europe/Amsterdam",
          },
        },
      };
      const body = JSON.stringify(samplePayload);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-TableWise-Event": sampleType,
        "X-TableWise-Test": "true",
      };
      if (ep.secret) {
        headers["X-TableWise-Signature"] = await sign(body, ep.secret);
      }

      let status = 0;
      let respBody = "";
      let errorMsg: string | null = null;

      if (dry_run) {
        // Dry-run: niets versturen, alleen de payload teruggeven en als preview opslaan.
        respBody = "(dry-run, niet verzonden naar ClickWise)";
        await sb.from("webhook_endpoints").update({
          last_test_at: new Date().toISOString(),
          last_test_status: "dry_run",
          last_test_response_code: null,
          last_test_response_body: respBody,
        }).eq("id", ep.id);
        return json({
          ok: true,
          dry_run: true,
          status: 0,
          response_body: respBody,
          sent_payload: samplePayload,
        });
      }

      try {
        const resp = await fetch(ep.url, {
          method: "POST", headers, body, signal: AbortSignal.timeout(10_000),
        });
        status = resp.status;
        respBody = (await resp.text()).slice(0, 1000);
      } catch (e) {
        errorMsg = e instanceof Error ? e.message : "fetch error";
      }

      const testStatus = errorMsg ? "error" : (status >= 200 && status < 300 ? "ok" : "http_error");
      await sb.from("webhook_endpoints").update({
        last_test_at: new Date().toISOString(),
        last_test_status: testStatus,
        last_test_response_code: errorMsg ? null : status,
        last_test_response_body: errorMsg ? errorMsg : respBody,
      }).eq("id", ep.id);

      return json({
        ok: testStatus === "ok",
        status,
        response_body: errorMsg ?? respBody,
        sent_payload: samplePayload,
      });
    }

    // ----- AVAILABILITY TEST -----
    if (action === "availability") {
      const { restaurant_id, date, party_size } = payload as { restaurant_id?: string; date?: string; party_size?: number };
      if (!restaurant_id || !date || !party_size) {
        return json({ error: "restaurant_id, date en party_size verplicht" }, 400);
      }
      const guard = await verifyManager(req, restaurant_id);
      if (!guard.ok) return json({ error: guard.error }, guard.status);

      const r = await callInternalFn("availability", { restaurant_id, date, party_size });
      return json({ ok: r.status >= 200 && r.status < 300, status: r.status, response: r.body });
    }

    // ----- BOOK TEST -----
    if (action === "book") {
      const { restaurant_id, date, time, party_size, guest, special_requests } = payload as {
        restaurant_id?: string; date?: string; time?: string; party_size?: number;
        guest?: { first_name?: string; last_name?: string; phone?: string; email?: string };
        special_requests?: string;
      };
      if (!restaurant_id) return json({ error: "restaurant_id verplicht" }, 400);
      const guard = await verifyManager(req, restaurant_id);
      if (!guard.ok) return json({ error: guard.error }, guard.status);
      if (!date || !time || !party_size || !guest?.first_name) {
        return json({ error: "date, time, party_size en guest.first_name zijn verplicht" }, 400);
      }
      const bookBody = {
        restaurant_id,
        date,
        time,
        party_size,
        guest: {
          first_name: guest.first_name,
          last_name: guest.last_name ?? "Test",
          phone: guest.phone ?? "+31600000000",
          email: guest.email ?? `integration-test-${Date.now()}@tablewise.local`,
        },
        special_requests: special_requests ?? "Integratie-test reservering",
        channel: "ai_host",
        source_metadata: { test: true, via: "integration_test" },
      };
      const r = await callInternalFn("book_reservation", bookBody);
      return json({ ok: r.status >= 200 && r.status < 300, status: r.status, response: r.body });
    }

    return json({ error: `Onbekende actie '${action}'` }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Onbekende fout" }, 500);
  }
});
