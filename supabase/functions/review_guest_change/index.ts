// review_guest_change
//
// Operator endpoint to approve or reject a pending guest_change_requests row.
// - approve: re-evaluates availability + applies the change to the reservation,
//   sends a "change approved" email.
// - reject: marks request rejected, sends "change rejected" email with reason.
//
// Auth: requires authenticated restaurant manager (RLS-checked via the user's JWT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  addMinutesIso,
  findAvailableSeating,
  zonedDateTimeToUtcIso,
} from "../_shared/reservation-utils.ts";

type Body = {
  request_id: string;
  action: "approve" | "reject";
  reviewer_note?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (!body?.request_id || !["approve", "reject"].includes(body.action)) {
      return json({ error: "invalid_input" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const { data: gcr } = await service.from("guest_change_requests")
      .select("*").eq("id", body.request_id).maybeSingle();
    if (!gcr) return json({ error: "not_found" }, 404);
    if (gcr.status !== "new") return json({ error: "already_reviewed" }, 409);

    // Verify the caller is a manager of this restaurant
    const { data: membership } = await userClient
      .from("restaurant_members")
      .select("role")
      .eq("restaurant_id", gcr.restaurant_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership || !["owner", "manager"].includes(membership.role)) {
      return json({ error: "forbidden" }, 403);
    }

    const { data: reservation } = await service.from("reservations")
      .select("*").eq("id", gcr.reservation_id).maybeSingle();
    if (!reservation) return json({ error: "reservation_not_found" }, 404);

    const { data: restaurant } = await service.from("restaurants")
      .select("id, name, slug, timezone, default_locale, locale, default_reservation_minutes, guest_reply_to_email")
      .eq("id", gcr.restaurant_id).maybeSingle();
    if (!restaurant) return json({ error: "restaurant_not_found" }, 404);

    const tz = restaurant.timezone || "Europe/Amsterdam";
    const locale = restaurant.default_locale || restaurant.locale || "nl";
    const durationMinutes = restaurant.default_reservation_minutes ?? 105;

    if (body.action === "approve") {
      let newStartIso: string | null = null;
      let newEndIso: string | null = null;
      let newCombo: { combinationId: string; tableIds: string[] } | null = null;

      const dateTimeChanged = gcr.desired_reservation_date !== reservation.reservation_date
        || formatTimeFromIso(reservation.start_time, tz) !== gcr.desired_time;
      const partyChanged = gcr.desired_party_size !== reservation.party_size;

      if (dateTimeChanged || partyChanged) {
        newStartIso = zonedDateTimeToUtcIso(gcr.desired_reservation_date, gcr.desired_time, tz);
        newEndIso = addMinutesIso(newStartIso, durationMinutes);
        newCombo = await findAvailableCombination(
          service, gcr.restaurant_id, gcr.desired_party_size, newStartIso, newEndIso, reservation.id,
        );
        if (!newCombo) return json({ error: "no_table_available" }, 409);
      }

      const updates: Record<string, unknown> = {};
      if (gcr.dietary_notes !== null && gcr.dietary_notes !== undefined) {
        updates.dietary_notes = gcr.dietary_notes;
      }
      if (dateTimeChanged || partyChanged) {
        updates.reservation_date = gcr.desired_reservation_date;
        updates.start_time = newStartIso;
        updates.end_time = newEndIso;
        updates.party_size = gcr.desired_party_size;
        updates.table_combination_id = newCombo!.combinationId;
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await service.from("reservations").update(updates).eq("id", reservation.id);
        if (error) return json({ error: "update_failed", detail: error.message }, 500);
        if ((dateTimeChanged || partyChanged) && newCombo) {
          await service.from("reservation_tables").delete().eq("reservation_id", reservation.id);
          await service.from("reservation_tables").insert(
            newCombo.tableIds.map((tid: string) => ({ reservation_id: reservation.id, table_id: tid })),
          );
        }
      }
      const contactPatch = (gcr.contact_patch ?? {}) as Record<string, unknown>;
      if (Object.keys(contactPatch).length > 0 && reservation.guest_id) {
        await service.from("guests").update(contactPatch).eq("id", reservation.guest_id);
      }

      await service.from("guest_change_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString(),
                  reviewed_by: userId, reviewer_note: body.reviewer_note ?? null })
        .eq("id", gcr.id);

      // Email guest
      const baseUrl = (Deno.env.get("SITE_URL") || "https://www.txtablewise.nl").replace(/\/+$/, "");
      const slugPart = restaurant.slug ? `/${restaurant.slug}` : "";
      const manageUrl = reservation.manage_token ? `${baseUrl}/r${slugPart}/manage/${reservation.manage_token}` : undefined;
      const cancelUrl = reservation.cancel_token ? `${baseUrl}/r${slugPart}/manage/${reservation.cancel_token}?action=cancel` : undefined;
      const startIso = newStartIso ?? reservation.start_time;
      if (gcr.guest_email && !/@tablewise\.local$/i.test(gcr.guest_email)) {
        try {
          await service.functions.invoke("send-transactional-email", {
            body: {
              templateName: "reservation-change-approved",
              recipientEmail: gcr.guest_email,
              idempotencyKey: `gcr_approved:${gcr.id}`,
              restaurantId: gcr.restaurant_id,
              locale, fromName: restaurant.name,
              replyTo: restaurant.guest_reply_to_email || undefined,
              templateData: {
                guestName: gcr.guest_name || "",
                restaurantName: restaurant.name,
                dateLabel: formatDateLabel(startIso, locale, tz),
                timeLabel: formatTimeLabel(startIso, locale, tz),
                partySize: gcr.desired_party_size,
                manageUrl, cancelUrl,
              },
            },
          });
        } catch (e) { console.error("approved email failed", e); }
      }

      await service.from("audit_log").insert({
        restaurant_id: gcr.restaurant_id, actor_user_id: userId,
        action: "guest_change.approved", entity: "reservation", entity_id: reservation.id,
        after_data: { request_id: gcr.id, ...updates },
      });

      return json({ ok: true, status: "approved" });
    }

    // reject
    await service.from("guest_change_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(),
                reviewed_by: userId, reviewer_note: body.reviewer_note ?? null })
      .eq("id", gcr.id);

    if (gcr.guest_email && !/@tablewise\.local$/i.test(gcr.guest_email)) {
      try {
        await service.functions.invoke("send-transactional-email", {
          body: {
            templateName: "reservation-change-rejected",
            recipientEmail: gcr.guest_email,
            idempotencyKey: `gcr_rejected:${gcr.id}`,
            restaurantId: gcr.restaurant_id,
            locale, fromName: restaurant.name,
            replyTo: restaurant.guest_reply_to_email || undefined,
            templateData: {
              guestName: gcr.guest_name || "",
              restaurantName: restaurant.name,
              dateLabel: formatDateLabel(reservation.start_time, locale, tz),
              timeLabel: formatTimeLabel(reservation.start_time, locale, tz),
              partySize: reservation.party_size,
              reasonLabel: body.reviewer_note || "",
            },
          },
        });
      } catch (e) { console.error("rejected email failed", e); }
    }

    await service.from("audit_log").insert({
      restaurant_id: gcr.restaurant_id, actor_user_id: userId,
      action: "guest_change.rejected", entity: "reservation", entity_id: reservation.id,
      after_data: { request_id: gcr.id, reviewer_note: body.reviewer_note ?? null },
    });

    return json({ ok: true, status: "rejected" });
  } catch (e) {
    console.error("review_guest_change error", e);
    return json({ error: "internal_error" }, 500);
  }
});

function formatTimeFromIso(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
function formatDateLabel(iso: string, locale: string, tz: string): string {
  try { return new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)); }
  catch { return iso.slice(0, 10); }
}
function formatTimeLabel(iso: string, locale: string, tz: string): string {
  try { return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); }
  catch { return iso.slice(11, 16); }
}
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
