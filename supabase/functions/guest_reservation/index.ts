// Guest self-service for a reservation via magic link token (manage_token or cancel_token).
// Public endpoint — no auth.
//
// request_change action:
//   Volautomatisch indien mogelijk. Server evalueert nieuwe datum/tijd/aantal personen
//   tegen openingstijden, min-notice, threshold en tafelcapaciteit. Bij contact-only
//   wijzigingen (naam/telefoon/email/dieet) wordt direct toegepast.
//   Drie uitkomsten:
//     - applied         → reservatie + contact bijgewerkt, e-mail "Wijziging bevestigd"
//     - rejected        → reservatie ongewijzigd, e-mail "Wijziging niet mogelijk"
//     - pending_review  → reservatie ongewijzigd, e-mail "Wijzigingsverzoek ontvangen",
//                          personeel handelt af
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  addMinutesIso,
  getWeekdayKey,
  pickSeatingWithStrategy,
  zonedDateTimeToUtcIso,
} from "../_shared/reservation-utils.ts";
import { notifyWaitlistOnCancel } from "../_shared/waitlist-notify.ts";

type Action = "view" | "confirm_attendance" | "cancel" | "request_change";

type Body = {
  token: string;
  action?: Action;
  reason?: string;
  locale?: string;
  // For request_change:
  desired_date?: string;        // YYYY-MM-DD
  desired_time?: string;        // HH:MM
  desired_party_size?: number;
  message?: string;
  desired_first_name?: string;
  desired_last_name?: string;
  desired_email?: string;
  desired_phone?: string;
  desired_dietary_notes?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_LOCALES = new Set(["nl", "en", "de", "fr"]);
const FINAL_STATUSES = new Set(["cancelled", "no_show", "completed"]);
const MAX_LEN = 200;

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

    const cols =
      "id, restaurant_id, guest_id, reservation_date, start_time, end_time, party_size, status, " +
      "confirmation_code, reminder_confirmed_at, special_requests, dietary_notes, " +
      "guest_first_name, guest_last_name, guest_email, guest_phone, " +
      "magic_token_expires_at, guest_language, manage_token, cancel_token";

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

    if (reservation.magic_token_expires_at) {
      const exp = new Date(reservation.magic_token_expires_at).getTime();
      if (Number.isFinite(exp) && exp < Date.now()) {
        return json({ error: "token_expired" }, 410);
      }
    }

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, name, slug, phone, email, timezone, default_locale, locale, " +
              "default_reservation_minutes, large_group_threshold, " +
              "guest_changes_auto_apply, guest_changes_min_notice_minutes, guest_changes_auto_reject_party_size, " +
              "guest_reply_to_email")
      .eq("id", reservation.restaurant_id).maybeSingle();
    if (!restaurant) return json({ error: "not_found" }, 404);

    // Resolve guest contact (snapshot fields first, then linked guests row)
    let guestRow: { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null } | null = null;
    if (reservation.guest_id) {
      const { data: g } = await supabase
        .from("guests").select("first_name, last_name, email, phone")
        .eq("id", reservation.guest_id).maybeSingle();
      guestRow = g ?? null;
    }
    const guestFirstName = reservation.guest_first_name ?? guestRow?.first_name ?? null;
    const guestLastName = reservation.guest_last_name ?? guestRow?.last_name ?? null;
    const guestEmail = reservation.guest_email ?? guestRow?.email ?? null;
    const guestPhone = reservation.guest_phone ?? guestRow?.phone ?? null;

    const safeReservation = {
      reservation_date: reservation.reservation_date,
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      party_size: reservation.party_size,
      status: reservation.status,
      confirmation_code: reservation.confirmation_code,
      reminder_confirmed_at: reservation.reminder_confirmed_at,
      special_requests: reservation.special_requests,
      dietary_notes: reservation.dietary_notes,
      guest_first_name: guestFirstName,
      guest_last_name: guestLastName,
      guest_email: guestEmail,
      guest_phone: guestPhone,
    };
    const restaurantPublic = {
      name: restaurant.name,
      slug: restaurant.slug,
      phone: restaurant.phone,
      email: restaurant.email,
      timezone: restaurant.timezone,
    };

    if (body.locale && VALID_LOCALES.has(body.locale) && body.locale !== reservation.guest_language) {
      try {
        await supabase.from("reservations").update({ guest_language: body.locale }).eq("id", reservation.id);
        if (reservation.guest_id) {
          await supabase.from("guests").update({ language: body.locale }).eq("id", reservation.guest_id);
        }
      } catch (e) {
        console.error("guest locale persist failed (non-fatal)", e);
      }
    }

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
        .from("reservations").update({ reminder_confirmed_at: nowIso }).eq("id", reservation.id);
      if (error) return json({ error: "update_failed" }, 500);
      await supabase.from("audit_log").insert({
        restaurant_id: reservation.restaurant_id, actor_label: "guest",
        action: "guest.confirm_attendance", entity: "reservation", entity_id: reservation.id,
      });
      return json({ ok: true, reservation: { ...safeReservation, reminder_confirmed_at: nowIso }, restaurant: restaurantPublic });
    }

    if (action === "cancel") {
      const { error } = await supabase
        .from("reservations")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(),
                  cancellation_reason: (body.reason ?? "").slice(0, 500) || null })
        .eq("id", reservation.id);
      if (error) return json({ error: "update_failed" }, 500);
      await supabase.from("audit_log").insert({
        restaurant_id: reservation.restaurant_id, actor_label: "guest",
        action: "guest.cancel", entity: "reservation", entity_id: reservation.id,
        after_data: body.reason ? { reason: body.reason.slice(0, 500) } : {},
      });
      await supabase.from("integration_events").insert({
        restaurant_id: reservation.restaurant_id, event_type: "reservation.cancelled", target: "clickwise",
        payload: {
          reservation_id: reservation.id, confirmation_code: reservation.confirmation_code,
          source: "guest_self_service", reason: (body.reason ?? "").slice(0, 500) || null,
        },
      });
      return json({ ok: true, reservation: { ...safeReservation, status: "cancelled" }, restaurant: restaurantPublic });
    }

    if (action === "request_change") {
      return await handleRequestChange(supabase, reservation, restaurant, body, safeReservation, restaurantPublic);
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("guest_reservation error", e);
    return json({ error: "internal_error" }, 500);
  }
});

// ----- request_change handler -----

// deno-lint-ignore no-explicit-any
async function handleRequestChange(sb: any, reservation: any, restaurant: any, body: Body, safeReservation: any, restaurantPublic: any) {
  const trim = (s?: string) => (s ?? "").trim().slice(0, MAX_LEN);
  const desiredDate = trim(body.desired_date) || reservation.reservation_date;
  const desiredTime = trim(body.desired_time) || formatTimeFromIso(reservation.start_time, restaurant.timezone);
  const desiredParty = Number.isFinite(body.desired_party_size) && (body.desired_party_size as number) > 0
    ? Math.floor(body.desired_party_size as number)
    : reservation.party_size;
  const message = (body.message ?? "").slice(0, 1000);

  // Detect what changed
  const currentTime = formatTimeFromIso(reservation.start_time, restaurant.timezone);
  const dateTimeChanged = desiredDate !== reservation.reservation_date || desiredTime !== currentTime;
  const partyChanged = desiredParty !== reservation.party_size;
  const contactPatch: Record<string, any> = {};
  if (body.desired_first_name !== undefined) contactPatch.first_name = trim(body.desired_first_name);
  if (body.desired_last_name !== undefined) contactPatch.last_name = trim(body.desired_last_name);
  if (body.desired_email !== undefined) contactPatch.email = trim(body.desired_email).toLowerCase() || null;
  if (body.desired_phone !== undefined) contactPatch.phone = trim(body.desired_phone) || null;
  const reservationPatch: Record<string, any> = {};
  if (body.desired_dietary_notes !== undefined) reservationPatch.dietary_notes = (body.desired_dietary_notes ?? "").slice(0, 1000);

  // Audit + integration event for "change requested" (always)
  await sb.from("audit_log").insert({
    restaurant_id: reservation.restaurant_id, actor_label: "guest",
    action: "guest.request_change", entity: "reservation", entity_id: reservation.id,
    before_data: {
      reservation_date: reservation.reservation_date, start_time: reservation.start_time,
      party_size: reservation.party_size, dietary_notes: reservation.dietary_notes,
    },
    after_data: {
      desired_date: desiredDate, desired_time: desiredTime, desired_party_size: desiredParty,
      message, has_contact_changes: Object.keys(contactPatch).length > 0,
    },
  });

  const autoEnabled = restaurant.guest_changes_auto_apply !== false;
  let outcome: "applied" | "rejected" | "pending_review" = "pending_review";
  let reasonCode: string | null = null;

  if (!dateTimeChanged && !partyChanged) {
    // Pure contact / dieet wijziging — direct toepassen
    outcome = "applied";
  } else if (!autoEnabled) {
    outcome = "pending_review";
    reasonCode = "auto_apply_disabled";
  } else {
    const evalResult = await evaluate(sb, reservation, restaurant, desiredDate, desiredTime, desiredParty);
    outcome = evalResult.outcome;
    reasonCode = evalResult.reasonCode;
  }

  // Apply changes if approved
  let newStartIso: string | null = null;
  let newEndIso: string | null = null;
  let newCombo: { combinationId: string | null; tableIds: string[] } | null = null;

  if (outcome === "applied") {
    if (dateTimeChanged || partyChanged) {
      const durationMinutes = restaurant.default_reservation_minutes ?? 105;
      newStartIso = zonedDateTimeToUtcIso(desiredDate, desiredTime, restaurant.timezone);
      newEndIso = addMinutesIso(newStartIso, durationMinutes);
      newCombo = await pickSeatingWithStrategy(sb, {
        restaurantId: reservation.restaurant_id,
        partySize: desiredParty,
        startIso: newStartIso,
        endIso: newEndIso,
        timezone: restaurant.timezone,
        date: desiredDate,
        excludeReservationId: reservation.id,
        prefersTerrace: !!reservation.prefers_terrace,
      });
      if (!newCombo) {
        outcome = "rejected";
        reasonCode = "no_table_available";
      }
    }
  }

  if (outcome === "applied") {
    const updates: Record<string, any> = { ...reservationPatch };
    if (dateTimeChanged || partyChanged) {
      updates.reservation_date = desiredDate;
      updates.start_time = newStartIso;
      updates.end_time = newEndIso;
      updates.party_size = desiredParty;
      updates.table_combination_id = newCombo!.combinationId;
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await sb.from("reservations").update(updates).eq("id", reservation.id);
      if (error) {
        console.error("apply change failed", error);
        outcome = "rejected";
        reasonCode = "update_failed";
      } else if ((dateTimeChanged || partyChanged) && newCombo) {
        // Replace reservation_tables met nieuwe combinatie
        await sb.from("reservation_tables").delete().eq("reservation_id", reservation.id);
        await sb.from("reservation_tables").insert(
          newCombo.tableIds.map((tid: string) => ({ reservation_id: reservation.id, table_id: tid })),
        );
      }
    }
    // Update guest contact if provided
    if (Object.keys(contactPatch).length > 0 && reservation.guest_id) {
      await sb.from("guests").update(contactPatch).eq("id", reservation.guest_id);
    }
  }

  // Build labels for emails
  const guest = reservation.guest_id
    ? (await sb.from("guests").select("first_name, full_name, email, language").eq("id", reservation.guest_id).maybeSingle()).data
    : null;
  const locale = (body.locale && VALID_LOCALES.has(body.locale) ? body.locale
                  : guest?.language || restaurant.default_locale || restaurant.locale || "nl");
  const tz = restaurant.timezone || "Europe/Amsterdam";
  const currentDateLabel = formatDateLabel(reservation.start_time, locale, tz);
  const currentTimeLabel = formatTimeLabel(reservation.start_time, locale, tz);
  const desiredStartIso = newStartIso ?? zonedDateTimeToUtcIso(desiredDate, desiredTime, tz);
  const desiredDateLabel = formatDateLabel(desiredStartIso, locale, tz);
  const desiredTimeLabel = formatTimeLabel(desiredStartIso, locale, tz);
  const guestName = guest?.first_name || guest?.full_name?.split(" ")[0] || "";
  const recipientEmail = contactPatch.email || guest?.email || null;

  // Integration events for ClickWise / dispatcher
  const eventType =
    outcome === "applied" ? "reservation.change_approved"
    : outcome === "rejected" ? "reservation.change_rejected"
    : "reservation.change_pending_staff";

  await sb.from("integration_events").insert({
    restaurant_id: reservation.restaurant_id,
    event_type: eventType,
    target: "internal",
    payload: {
      reservation_id: reservation.id,
      confirmation_code: reservation.confirmation_code,
      outcome, reason_code: reasonCode,
      desired_date: desiredDate, desired_time: desiredTime, desired_party_size: desiredParty,
      message,
    },
  });

  // Cancel any older still-open requests for this reservation
  try {
    await sb.from("guest_change_requests")
      .update({ status: "cancelled", reviewed_at: new Date().toISOString() })
      .eq("reservation_id", reservation.id)
      .eq("status", "new");
  } catch (e) { console.error("cancel prior gcr failed (non-fatal)", e); }

  // If staff review needed, persist a row so it shows up in the operator app
  if (outcome === "pending_review") {
    try {
      await sb.from("guest_change_requests").insert({
        restaurant_id: reservation.restaurant_id,
        reservation_id: reservation.id,
        status: "new",
        reason_code: reasonCode,
        current_reservation_date: reservation.reservation_date,
        current_start_time: reservation.start_time,
        current_party_size: reservation.party_size,
        desired_reservation_date: desiredDate,
        desired_time: desiredTime,
        desired_party_size: desiredParty,
        message: message || null,
        contact_patch: contactPatch,
        dietary_notes: reservationPatch.dietary_notes ?? null,
        guest_name: [guest?.first_name, guest?.full_name].filter(Boolean)[0] || guestName || null,
        guest_email: recipientEmail,
      });
    } catch (e) {
      console.error("insert guest_change_requests failed (non-fatal)", e);
    }
  }

  // Send the appropriate email — best-effort
  if (recipientEmail && !/@tablewise\.local$/i.test(recipientEmail)) {
    const baseUrl = (Deno.env.get("SITE_URL") || "https://www.txtablewise.nl").replace(/\/+$/, "");
    const slugPart = restaurant.slug ? `/${restaurant.slug}` : "";
    const manageUrl = reservation.manage_token ? `${baseUrl}/r${slugPart}/manage/${reservation.manage_token}` : undefined;
    const cancelUrl = reservation.cancel_token ? `${baseUrl}/r${slugPart}/manage/${reservation.cancel_token}?action=cancel` : undefined;

    let templateName: string;
    let templateData: Record<string, any> = {
      guestName,
      restaurantName: restaurant.name,
      locale,
    };
    if (outcome === "applied") {
      templateName = "reservation-change-approved";
      templateData = {
        ...templateData,
        dateLabel: desiredDateLabel,
        timeLabel: desiredTimeLabel,
        partySize: desiredParty,
        manageUrl,
        cancelUrl,
      };
    } else if (outcome === "rejected") {
      templateName = "reservation-change-rejected";
      templateData = {
        ...templateData,
        dateLabel: currentDateLabel,
        timeLabel: currentTimeLabel,
        partySize: reservation.party_size,
        reasonLabel: reasonLabelFor(reasonCode, locale),
      };
    } else {
      templateName = "reservation-change-received";
      templateData = {
        ...templateData,
        dateLabel: currentDateLabel,
        timeLabel: currentTimeLabel,
        partySize: reservation.party_size,
        desiredDateLabel,
        desiredTimeLabel,
        desiredPartySize: desiredParty,
        message,
      };
    }
    try {
      await sb.functions.invoke("send-transactional-email", {
        body: {
          templateName, recipientEmail,
          idempotencyKey: `${eventType}:${reservation.id}:${Date.now()}`,
          restaurantId: reservation.restaurant_id, locale, templateData,
          fromName: restaurant.name,
          replyTo: restaurant.guest_reply_to_email || undefined,
        },
      });
    } catch (e) {
      console.error("send change email failed (non-fatal)", e);
    }
  }

  // Build response payload reflecting new state
  const updatedReservation = outcome === "applied"
    ? {
        ...safeReservation,
        reservation_date: newStartIso ? desiredDate : safeReservation.reservation_date,
        start_time: newStartIso ?? safeReservation.start_time,
        end_time: newEndIso ?? safeReservation.end_time,
        party_size: (dateTimeChanged || partyChanged) ? desiredParty : safeReservation.party_size,
      }
    : safeReservation;

  return json({
    ok: true,
    outcome, // "applied" | "rejected" | "pending_review"
    reason_code: reasonCode,
    reservation: updatedReservation,
    restaurant: restaurantPublic,
  });
}

// deno-lint-ignore no-explicit-any
async function evaluate(sb: any, reservation: any, restaurant: any, desiredDate: string, desiredTime: string, desiredParty: number): Promise<{ outcome: "applied" | "rejected" | "pending_review"; reasonCode: string | null }> {
  const tz = restaurant.timezone || "Europe/Amsterdam";
  const durationMinutes = restaurant.default_reservation_minutes ?? 105;

  // 1. Min notice
  const desiredStartIso = zonedDateTimeToUtcIso(desiredDate, desiredTime, tz);
  const startMs = new Date(desiredStartIso).getTime();
  const minNoticeMin = restaurant.guest_changes_min_notice_minutes ?? 240;
  if (startMs - Date.now() < minNoticeMin * 60_000) {
    return { outcome: "rejected", reasonCode: "too_late_min_notice" };
  }

  // 2. Threshold for staff review
  const threshold = restaurant.guest_changes_auto_reject_party_size ?? restaurant.large_group_threshold ?? 9;
  if (desiredParty >= threshold) {
    return { outcome: "pending_review", reasonCode: "large_party_needs_staff" };
  }

  // 3. Closures
  const { data: closures } = await sb.from("closures").select("*")
    .eq("restaurant_id", reservation.restaurant_id)
    .lte("start_date", desiredDate).gte("end_date", desiredDate);
  if ((closures ?? []).some((c: any) => c.is_full_day)) {
    return { outcome: "rejected", reasonCode: "closed_on_date" };
  }

  // 4. Opening hours for the desired weekday (in restaurant tz)
  const weekday = getWeekdayKey(new Date(desiredStartIso), tz);
  const { data: hours } = await sb.from("opening_hours").select("*")
    .eq("restaurant_id", reservation.restaurant_id).eq("weekday", weekday).eq("is_closed", false);
  const desiredEndMin = toMinutes(desiredTime) + durationMinutes;
  const startMin = toMinutes(desiredTime);
  const fits = (hours ?? []).some((h: any) => {
    const o = toMinutes(String(h.open_time).slice(0, 5));
    const c = toMinutes(String(h.close_time).slice(0, 5));
    return o <= startMin && desiredEndMin <= c;
  });
  if (!fits) {
    return { outcome: "rejected", reasonCode: "outside_opening_hours" };
  }

  // 5. Partial closures intersect
  const partial = (closures ?? []).filter((c: any) => !c.is_full_day && c.start_time && c.end_time);
  for (const c of partial) {
    const cs = toMinutes(String(c.start_time).slice(0, 5));
    const ce = toMinutes(String(c.end_time).slice(0, 5));
    if (startMin < ce && cs < desiredEndMin) {
      return { outcome: "rejected", reasonCode: "partial_closure" };
    }
  }

  // 6. Table availability
  const desiredEndIso = addMinutesIso(desiredStartIso, durationMinutes);
  const combo = await pickSeatingWithStrategy(sb, {
    restaurantId: reservation.restaurant_id,
    partySize: desiredParty,
    startIso: desiredStartIso,
    endIso: desiredEndIso,
    timezone: restaurant.timezone,
    date: desiredDate,
    excludeReservationId: reservation.id,
    prefersTerrace: !!reservation.prefers_terrace,
  });
  if (!combo) {
    return { outcome: "rejected", reasonCode: "no_table_available" };
  }

  return { outcome: "applied", reasonCode: null };
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTimeFromIso(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

function formatDateLabel(iso: string, locale: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function formatTimeLabel(iso: string, locale: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

function reasonLabelFor(code: string | null, locale: string): string {
  const map: Record<string, Record<string, string>> = {
    too_late_min_notice: {
      nl: "Te kort van tevoren aangevraagd", en: "Requested too close to the time",
      de: "Zu kurzfristig angefragt", fr: "Demande trop tardive",
    },
    closed_on_date: {
      nl: "We zijn die dag gesloten", en: "We are closed on that date",
      de: "Wir haben an diesem Tag geschlossen", fr: "Nous sommes fermés ce jour-là",
    },
    outside_opening_hours: {
      nl: "Buiten onze openingstijden", en: "Outside our opening hours",
      de: "Außerhalb der Öffnungszeiten", fr: "En dehors des heures d’ouverture",
    },
    partial_closure: {
      nl: "Op dat tijdstip is de zaal gesloten", en: "We are closed at that time",
      de: "Zu dieser Zeit geschlossen", fr: "Fermé à cette heure",
    },
    no_table_available: {
      nl: "Geen tafel beschikbaar voor het gewenste tijdstip", en: "No table available at the requested time",
      de: "Kein Tisch verfügbar zur gewünschten Zeit", fr: "Aucune table disponible à cette heure",
    },
    update_failed: {
      nl: "Er ging iets technisch mis", en: "A technical error occurred",
      de: "Ein technischer Fehler ist aufgetreten", fr: "Une erreur technique est survenue",
    },
  };
  if (!code) return "";
  return map[code]?.[locale] || map[code]?.nl || "";
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
