// Guest self-service for a reservation via magic link token (manage_token or cancel_token).
// Public endpoint — no auth. Returns minimal safe data and supports limited actions.
//
// Hardening notes (Prompt 21):
// - Tokens are never echoed back to the client (not even inside `safeReservation`).
// - We never SELECT * — only the columns required for guest-facing rendering.
// - magic_token_expires_at is enforced server-side; expired tokens fail closed.
// - Status transitions for guest actions are restricted (no re-opening cancelled/no-show).
// - Audit + integration events log the action but never include the token itself.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

type Action = "view" | "confirm_attendance" | "cancel" | "request_change";

type Body = {
  token: string;
  action?: Action;
  reason?: string;
  locale?: string;
  // For request_change:
  desired_date?: string;
  desired_time?: string;
  desired_party_size?: number;
  message?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_LOCALES = new Set(["nl", "en", "de", "fr"]);

// Statuses that disallow further guest mutation. View remains allowed.
const FINAL_STATUSES = new Set(["cancelled", "no_show", "completed"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.token || !UUID_RE.test(body.token)) {
      return json({ error: "invalid_token" }, 400);
    }
    const action: Action = body.action ?? "view";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up by manage_token first, then cancel_token.
    // We DO need to fetch magic_token_expires_at server-side, but it never leaves this function.
    const cols =
      "id, restaurant_id, guest_id, reservation_date, start_time, end_time, party_size, status, " +
      "confirmation_code, reminder_confirmed_at, special_requests, magic_token_expires_at, guest_language";

    const { data: byManage } = await supabase
      .from("reservations").select(cols)
      .eq("manage_token", body.token).maybeSingle();

    let reservation = byManage;
    if (!reservation) {
      const { data: byCancel } = await supabase
        .from("reservations").select(cols)
        .eq("cancel_token", body.token).maybeSingle();
      reservation = byCancel ?? null;
    }
    if (!reservation) return json({ error: "not_found" }, 404);

    // Hardening: enforce token expiry server-side. If expires_at is set and in the past,
    // refuse all actions including view to avoid information disclosure via stale links.
    if (reservation.magic_token_expires_at) {
      const exp = new Date(reservation.magic_token_expires_at).getTime();
      if (Number.isFinite(exp) && exp < Date.now()) {
        return json({ error: "token_expired" }, 410);
      }
    }

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, name, slug, phone, email, timezone")
      .eq("id", reservation.restaurant_id).maybeSingle();
    if (!restaurant) return json({ error: "not_found" }, 404);

    const safeReservation = {
      reservation_date: reservation.reservation_date,
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      party_size: reservation.party_size,
      status: reservation.status,
      confirmation_code: reservation.confirmation_code,
      reminder_confirmed_at: reservation.reminder_confirmed_at,
      special_requests: reservation.special_requests,
    };
    const restaurantPublic = {
      name: restaurant.name,
      slug: restaurant.slug,
      phone: restaurant.phone,
      email: restaurant.email,
      timezone: restaurant.timezone,
    };

    // Final-status reservations: only allow view, return a stable error code per status.
    if (FINAL_STATUSES.has(reservation.status) && action !== "view") {
      const code =
        reservation.status === "cancelled" ? "already_cancelled" :
        reservation.status === "no_show"   ? "already_no_show" :
                                              "already_completed";
      return json({ reservation: safeReservation, restaurant: restaurantPublic, error: code }, 409);
    }

    if (action === "view") {
      return json({ reservation: safeReservation, restaurant: restaurantPublic });
    }

    if (action === "confirm_attendance") {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("reservations")
        .update({ reminder_confirmed_at: nowIso })
        .eq("id", reservation.id);
      if (error) return json({ error: "update_failed" }, 500);

      await supabase.from("audit_log").insert({
        restaurant_id: reservation.restaurant_id,
        actor_label: "guest",
        action: "guest.confirm_attendance",
        entity: "reservation",
        entity_id: reservation.id,
      });

      return json({
        ok: true,
        reservation: { ...safeReservation, reminder_confirmed_at: nowIso },
        restaurant: restaurantPublic,
      });
    }

    if (action === "cancel") {
      const { error } = await supabase
        .from("reservations")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(),
                  cancellation_reason: (body.reason ?? "").slice(0, 500) || null })
        .eq("id", reservation.id);
      if (error) return json({ error: "update_failed" }, 500);

      await supabase.from("audit_log").insert({
        restaurant_id: reservation.restaurant_id,
        actor_label: "guest",
        action: "guest.cancel",
        entity: "reservation",
        entity_id: reservation.id,
        after_data: body.reason ? { reason: body.reason.slice(0, 500) } : {},
      });

      // Fire integration event for ClickWise / webhook dispatcher.
      // Never include the token in the payload.
      await supabase.from("integration_events").insert({
        restaurant_id: reservation.restaurant_id,
        event_type: "reservation.cancelled",
        target: "clickwise",
        payload: {
          reservation_id: reservation.id,
          confirmation_code: reservation.confirmation_code,
          source: "guest_self_service",
          reason: (body.reason ?? "").slice(0, 500) || null,
        },
      });

      return json({
        ok: true,
        reservation: { ...safeReservation, status: "cancelled" },
        restaurant: restaurantPublic,
      });
    }

    if (action === "request_change") {
      // Do not modify the reservation directly — log a request for staff to handle.
      await supabase.from("integration_events").insert({
        restaurant_id: reservation.restaurant_id,
        event_type: "guest.change_requested",
        target: "internal",
        payload: {
          reservation_id: reservation.id,
          confirmation_code: reservation.confirmation_code,
          desired_date: body.desired_date ?? null,
          desired_time: body.desired_time ?? null,
          desired_party_size: body.desired_party_size ?? null,
          message: (body.message ?? "").slice(0, 1000),
        },
      });

      await supabase.from("audit_log").insert({
        restaurant_id: reservation.restaurant_id,
        actor_label: "guest",
        action: "guest.request_change",
        entity: "reservation",
        entity_id: reservation.id,
        after_data: {
          desired_date: body.desired_date ?? null,
          desired_time: body.desired_time ?? null,
          desired_party_size: body.desired_party_size ?? null,
        },
      });

      return json({ ok: true, reservation: safeReservation, restaurant: restaurantPublic });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    // Never echo raw error messages to the public — log internally only.
    console.error("guest_reservation error", e);
    return json({ error: "internal_error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
