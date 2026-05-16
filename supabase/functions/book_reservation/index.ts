// Book reservation — atomic, with table assignment + conflict re-check.
// Public endpoint (used by guest widget). Channel defaults to 'online'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  zonedDateTimeToUtcIso, addMinutesIso, intervalsOverlap, ACTIVE_STATUSES,
  findAvailableCombination,
} from "../_shared/reservation-utils.ts";
import { evaluatePacing, type PacingReservation } from "../_shared/pacing.ts";
import { durationMinutesFor } from "../_shared/duration.ts";

type BookRequest = {
  restaurant_id?: string;
  restaurant_slug?: string;
  date: string;
  time: string;          // HH:MM in restaurant tz
  party_size: number;
  guest: {
    first_name: string;
    last_name?: string;
    phone?: string;
    email: string;
    language?: string;
  };
  special_requests?: string;
  dietary_notes?: string;
  occasion?: string;
  marketing_consent?: boolean;
  channel?: "online" | "ai_host" | "phone" | "walk_in" | "manager" | "clickwise" | "import";
  hold_only?: boolean;   // if true, create as hold (default false → confirmed)
  source_metadata?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as BookRequest;
    const missing: string[] = [];
    if (!body?.date) missing.push("date");
    if (!body?.time) missing.push("time");
    if (!body?.party_size) missing.push("party_size");
    if (!body?.guest?.first_name) missing.push("guest.first_name");
    if (!body?.guest?.email && !body?.guest?.phone) missing.push("guest.phone");
    if (missing.length) return json({ error: `Missing required fields: ${missing.join(", ")}`, error_code: "missing_field", field: missing[0] }, 400);
    if (!(body.restaurant_id || body.restaurant_slug)) return json({ error: "Restaurant required", error_code: "missing_field", field: "restaurant_id" }, 400);
    if (body.party_size < 1 || body.party_size > 50) return json({ error: "Invalid party_size", error_code: "invalid_field", field: "party_size" }, 400);
    if (body.guest.email && !/^\S+@\S+\.\S+$/.test(body.guest.email)) return json({ error: "Invalid email", error_code: "invalid_email", field: "guest.email" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve restaurant
    const restQuery = body.restaurant_id
      ? supabase.from("restaurants").select("*").eq("id", body.restaurant_id).maybeSingle()
      : supabase.from("restaurants").select("*").eq("slug", body.restaurant_slug!).maybeSingle();
    const { data: restaurant, error: rErr } = await restQuery;
    if (rErr) return json({ error: rErr.message, error_code: "internal" }, 500);
    if (!restaurant) return json({ error: "Restaurant not found", error_code: "not_found", field: "restaurant_id" }, 404);

    const onlineHardCap: number = restaurant.large_group_max_online_request ?? restaurant.max_party_size_online;
    if (body.party_size > onlineHardCap && body.channel !== "manager" && body.channel !== "walk_in") {
      return json({ error: "Party size exceeds online limit", error_code: "large_group_required_manual", field: "party_size", large_group: true }, 400);
    }
    const extraInfoFrom: number | null = restaurant.large_group_extra_info_from ?? null;
    if (extraInfoFrom !== null && body.party_size >= extraInfoFrom && body.channel !== "manager" && body.channel !== "walk_in") {
      const msg = (body.special_requests ?? "").trim();
      if (!msg) {
        return json({ error: "Bericht aan restaurant verplicht voor deze groepsgrootte", error_code: "message_required", field: "special_requests" }, 400);
      }
    }

    const tz: string = restaurant.timezone;
    const largeGroupThreshold: number = restaurant.large_group_threshold || 9;
    const channel = body.channel ?? "online";
    // Walk-ins use the operator-configured walk-in duration
    const isWalkIn = channel === "walk_in";
    const isLargeGroup = body.party_size >= largeGroupThreshold;
    const durationMinutes: number = isWalkIn
      ? (restaurant.walkin_default_minutes ?? 75)
      : durationMinutesFor(body.party_size, restaurant);
    const start_iso = zonedDateTimeToUtcIso(body.date, body.time, tz);
    const end_iso = addMinutesIso(start_iso, durationMinutes);

    // Lead-time only applies to guest-facing channels; operator flows (manager/walk-in) bypass.
    const operatorChannels = new Set(["manager", "walk_in"]);
    if (!operatorChannels.has(channel)) {
      const leadMin = restaurant.booking_lead_time_minutes ?? 0;
      if (new Date(start_iso).getTime() < Date.now() + leadMin * 60_000) {
        return json({ error: "Slot too soon", error_code: "slot_too_soon", field: "time" }, 400);
      }
    }

    // Find fitting individual tables
    const { data: tables } = await supabase
      .from("tables").select("id, capacity_min, capacity_max")
      .eq("restaurant_id", restaurant.id).eq("is_active", true)
      .lte("capacity_min", body.party_size).gte("capacity_max", body.party_size)
      .order("capacity_max", { ascending: true });

    // Existing active reservations overlapping window
    const { data: existing } = await supabase
      .from("reservations")
      .select("id, start_time, end_time, party_size, status, hold_expires_at, reservation_tables(table_id)")
      .eq("restaurant_id", restaurant.id)
      .gte("start_time", addMinutesIso(start_iso, -durationMinutes))
      .lte("start_time", addMinutesIso(end_iso, durationMinutes))
      .in("status", ACTIVE_STATUSES as unknown as string[]);

    const now = new Date();
    const live = (existing ?? []).filter((r) =>
      r.status !== "hold" || (r.hold_expires_at && new Date(r.hold_expires_at) > now)
    );
    const occupied = new Set<string>();
    for (const r of live) {
      if (intervalsOverlap(start_iso, end_iso, r.start_time, r.end_time)) {
        for (const rt of (r.reservation_tables ?? [])) occupied.add(rt.table_id);
      }
    }

    // Prefer single fitting table; fall back to a combination if none fits
    const candidate = (tables ?? []).find((t) => !occupied.has(t.id)) ?? null;
    let chosenTableIds: string[] = [];
    let chosenCombinationId: string | null = null;
    if (candidate) {
      chosenTableIds = [candidate.id];
    } else {
      const combo = await findAvailableCombination(
        supabase, restaurant.id, body.party_size, start_iso, end_iso,
      );
      if (!combo) {
        return json({ error: "Geen tafel of combinatie beschikbaar voor deze groepsgrootte op dit moment", error_code: "no_table_available", field: "party_size" }, 409);
      }
      chosenTableIds = combo.tableIds;
      chosenCombinationId = combo.combinationId;
    }

    // Pacing check (skip for operator-driven walk-ins / manager bookings)
    const skipPacing = channel === "walk_in" || channel === "manager";
    if (!skipPacing) {
      const pacingRows: PacingReservation[] = live.map((r) => ({
        id: r.id,
        start_time: r.start_time,
        end_time: r.end_time,
        party_size: (r as { party_size?: number }).party_size ?? 0,
        status: r.status,
        hold_expires_at: r.hold_expires_at,
      }));
      const pacing = evaluatePacing(
        { start_iso, end_iso, party_size: body.party_size },
        pacingRows,
        {
          max_covers_per_slot: restaurant.max_covers_per_slot ?? null,
          max_new_reservations_per_15min: restaurant.max_new_reservations_per_15min ?? null,
          peak_warning_threshold_pct: restaurant.peak_warning_threshold_pct ?? 85,
        },
      );
      if (!pacing.ok) {
        return json({
          error: "Dit tijdslot is operationeel vol. Kies een ander tijdstip of plaats de gast op de wachtlijst.",
          error_code: "pacing_limit_reached",
          field: "time",
          reason: pacing.reason,
          pacing_full: true,
        }, 409);
      }
    }

    // Upsert guest by (restaurant_id, email) when email provided, otherwise by phone
    let guestId: string | null = null;
    const lookup = supabase.from("guests").select("id").eq("restaurant_id", restaurant.id);
    const { data: existingGuest } = body.guest.email
      ? await lookup.eq("email", body.guest.email).maybeSingle()
      : body.guest.phone
        ? await lookup.eq("phone", body.guest.phone).maybeSingle()
        : { data: null as { id: string } | null };
    if (existingGuest) {
      guestId = existingGuest.id;
      await supabase.from("guests").update({
        first_name: body.guest.first_name,
        last_name: body.guest.last_name ?? null,
        phone: body.guest.phone ?? null,
        email: body.guest.email ?? null,
        language: body.guest.language ?? "nl",
        marketing_consent: body.marketing_consent ?? false,
      }).eq("id", guestId);
    } else {
      const { data: newGuest, error: gErr } = await supabase.from("guests").insert({
        restaurant_id: restaurant.id,
        first_name: body.guest.first_name,
        last_name: body.guest.last_name ?? null,
        phone: body.guest.phone ?? null,
        email: body.guest.email ?? null,
        language: body.guest.language ?? "nl",
        marketing_consent: body.marketing_consent ?? false,
      }).select("id").single();
      if (gErr) return json({ error: gErr.message }, 500);
      guestId = newGuest.id;
    }

    // Determine status using onboarding rules.
    // Operator-driven walk-ins are seated immediately; manager flow auto-confirms.
    // For online/AI/phone bookings: respect auto_confirm and manual_approval_from_party_size.
    const manualApprovalSize: number | null = restaurant.manual_approval_from_party_size ?? null;
    const largeGroupManualFrom: number = restaurant.large_group_manual_approval_from ?? 10;
    const largeGroupAutoBookMax: number = restaurant.large_group_auto_book_max ?? 12;

    let requiresManualApproval = false;
    let largeGroupStatus: string | null = null;

    if (isLargeGroup) {
      if (body.party_size >= largeGroupManualFrom || body.party_size > largeGroupAutoBookMax) {
        requiresManualApproval = true;
        largeGroupStatus = "awaiting_approval";
      } else {
        largeGroupStatus = "auto_booked";
      }
    }
    if (manualApprovalSize !== null && body.party_size >= manualApprovalSize) {
      requiresManualApproval = true;
    }
    if (channel === "online" && restaurant.auto_confirm === false) {
      requiresManualApproval = true;
    }

    let status: string;
    if (body.hold_only) status = "hold";
    else if (isWalkIn) status = "seated";
    else if (channel === "manager") status = "confirmed";
    else if (requiresManualApproval) status = "pending";
    else status = "confirmed";

    const holdExpires = body.hold_only
      ? new Date(Date.now() + (restaurant.hold_minutes ?? 10) * 60_000).toISOString()
      : null;
    const confirmationCode = generateCode();

    // Insert reservation
    const { data: reservation, error: resErr } = await supabase.from("reservations").insert({
      restaurant_id: restaurant.id,
      guest_id: guestId,
      reservation_date: body.date,
      start_time: start_iso,
      end_time: end_iso,
      party_size: body.party_size,
      status,
      channel,
      special_requests: body.special_requests ?? null,
      dietary_notes: body.dietary_notes ?? null,
      occasion: body.occasion ?? null,
      hold_expires_at: holdExpires,
      confirmation_code: confirmationCode,
      source_metadata: body.source_metadata ?? {},
      requires_manual_approval: requiresManualApproval,
      large_group_status: largeGroupStatus,
      table_combination_id: chosenCombinationId,
      guest_language: body.guest?.language && ["nl","en","de","fr"].includes(body.guest.language) ? body.guest.language : null,
      // Snapshot of guest data at time of booking (so historic reservations
      // don't change name/contact when the same email re-books later).
      guest_first_name: body.guest.first_name,
      guest_last_name: body.guest.last_name ?? null,
      guest_email: body.guest.email ?? null,
      guest_phone: body.guest.phone ?? null,
    }).select("*").single();

    if (resErr) return json({ error: resErr.message }, 500);

    // Link table(s) — single table or all tables of the chosen combination
    const { error: rtErr } = await supabase.from("reservation_tables").insert(
      chosenTableIds.map((tid) => ({ reservation_id: reservation.id, table_id: tid })),
    );
    if (rtErr) {
      await supabase.from("reservations").delete().eq("id", reservation.id);
      const isOverlap = (rtErr as any).code === "23505" || /already.*booked|geboekt/i.test(rtErr.message);
      if (isOverlap) {
        return json({ error: "Slot net bezet door een andere reservering, probeer opnieuw", error_code: "slot_unavailable", field: "time", retry: true }, 409);
      }
      return json({ error: "Failed to assign table: " + rtErr.message }, 500);
    }

    // Re-check race condition across ALL chosen tables
    const { data: doubleCheck } = await supabase
      .from("reservation_tables")
      .select("reservation_id, table_id, reservations!inner(start_time, end_time, status, hold_expires_at)")
      .in("table_id", chosenTableIds);
    const conflicts = ((doubleCheck ?? []) as unknown as Array<{
      reservation_id: string;
      table_id: string;
      reservations: { start_time: string; end_time: string; status: string; hold_expires_at: string | null } | null;
    }>).filter((row) => {
      if (row.reservation_id === reservation.id) return false;
      const r = row.reservations;
      if (!r) return false;
      if (!ACTIVE_STATUSES.includes(r.status as typeof ACTIVE_STATUSES[number])) return false;
      if (r.status === "hold" && (!r.hold_expires_at || new Date(r.hold_expires_at) <= now)) return false;
      return intervalsOverlap(start_iso, end_iso, r.start_time, r.end_time);
    });
    if (conflicts.length > 0) {
      await supabase.from("reservation_tables").delete().eq("reservation_id", reservation.id);
      await supabase.from("reservations").delete().eq("id", reservation.id);
      return json({ error: "Slot net bezet door een andere reservering, probeer opnieuw", error_code: "slot_unavailable", field: "time", retry: true }, 409);
    }

    // Emit integration event (fire-and-forget)
    await supabase.from("integration_events").insert({
      restaurant_id: restaurant.id,
      event_type: "reservation.created",
      target: "clickwise",
      payload: {
        reservation_id: reservation.id,
        confirmation_code: confirmationCode,
        channel,
        party_size: body.party_size,
        start_time: start_iso,
        guest: { email: body.guest.email ?? null, phone: body.guest.phone ?? null, first_name: body.guest.first_name },
      },
    });

    // Gastvrij bevestigingsmail via TableWise (alleen wanneer aangezet + email aanwezig)
    if (body.guest.email && restaurant.guest_email_enabled !== false && status !== "hold") {
      try {
        const guestLocale = (body.guest.language && ["nl","en","de","fr"].includes(body.guest.language))
          ? body.guest.language : (restaurant.default_locale || "nl");
        const intlLocale = `${guestLocale}-${guestLocale === "nl" ? "NL" : guestLocale === "de" ? "DE" : guestLocale === "fr" ? "FR" : "GB"}`;
        const dt = new Date(start_iso);
        const dateLabel = dt.toLocaleDateString(intlLocale, {
          weekday: "long", day: "numeric", month: "long",
          timeZone: restaurant.timezone || "Europe/Amsterdam",
        });
        const timeLabel = dt.toLocaleTimeString(intlLocale, {
          hour: "2-digit", minute: "2-digit",
          timeZone: restaurant.timezone || "Europe/Amsterdam",
        });
        const baseUrl = (Deno.env.get("SITE_URL") || "https://www.txtablewise.nl").replace(/\/+$/, "");
        const slugPart = restaurant.slug ? `/${restaurant.slug}` : "";
        const manageUrl = reservation.manage_token ? `${baseUrl}/r${slugPart}/manage/${reservation.manage_token}` : undefined;
        const cancelUrl = reservation.cancel_token ? `${baseUrl}/r${slugPart}/manage/${reservation.cancel_token}?action=cancel` : undefined;
        // Direct fetch met expliciete anon-key auth — supabase.functions.invoke()
        // van binnenuit een edge function stuurt de Authorization header soms niet
        // mee, en SUPABASE_SERVICE_ROLE_KEY is in de nieuwe key-formaat geen geldige
        // JWT meer voor de gateway. De anon key (klassieke JWT) is wél geldig en
        // bypasst verify_jwt=true op send-transactional-email.
        // Legacy anon JWT — publieke key, alleen nodig om gateway-verify_jwt te
        // passeren omdat de nieuwe sb_publishable_... keys niet als JWT herkend worden.
        const LEGACY_ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiaHR6dGJweG1xbHpoeWVwaGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNjE3OTAsImV4cCI6MjA5MjYzNzc5MH0.rbPfp5VdOkgPysCU57BpQoLikGyyZ-UYn9cKSaSPxvA";
        const anonKey = LEGACY_ANON_JWT;
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const mailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            templateName: "reservation-confirmation",
            recipientEmail: body.guest.email,
            idempotencyKey: `reservation-confirmation-${reservation.id}`,
            fromName: restaurant.name,
            replyTo: restaurant.guest_reply_to_email || undefined,
            restaurantId: restaurant.id,
            locale: guestLocale,
            templateData: {
              guestName: body.guest.first_name || undefined,
              dateLabel,
              timeLabel,
              partySize: body.party_size,
              manageUrl,
              cancelUrl,
            },
          }),
        });
        if (!mailRes.ok) {
          const errText = await mailRes.text().catch(() => "");
          console.error("guest confirmation email failed (non-fatal)", mailRes.status, errText);
        }
      } catch (mailErr) {
        console.error("guest confirmation email failed (non-fatal)", mailErr);
      }
    }

    return json({
      ok: true,
      reservation: {
        id: reservation.id,
        confirmation_code: confirmationCode,
        status,
        start_time: start_iso,
        end_time: end_iso,
        party_size: body.party_size,
        table_id: chosenTableIds[0],
        table_ids: chosenTableIds,
        table_combination_id: chosenCombinationId,
        hold_expires_at: holdExpires,
      },
    });
  } catch (e) {
    console.error("book_reservation error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
