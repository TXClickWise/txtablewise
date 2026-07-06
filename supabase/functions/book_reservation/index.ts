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
import {
  resolveActiveZones, pickTableWithFillStrategy, pickCombinationWithFillStrategy,
  type ZoneRow, type TableRow as FillTableRow, type WeatherRow, type CombinationRow,
} from "../_shared/zone-fill.ts";

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
  prefers_terrace?: boolean; // soft hint — used by fill strategy when enabled
  /** Operator-only (walk_in / manager): force a specific table instead of engine pick. */
  preselected_table_id?: string;
  /** Operator-only: force a multi-table combination (walk-in of grote groep). */
  preselected_table_ids?: string[];
  preselected_combination_id?: string;
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
      const transferInfo = await computeTransferAvailability(supabase, restaurant);
      return json({
        error: "Party size exceeds online limit",
        error_code: "large_group_required_manual",
        field: "party_size",
        large_group: true,
        transfer: transferInfo,
      }, 400);
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
      // Booking horizon: prevent bookings too far into the future.
      const horizonDays: number | null = restaurant.booking_horizon_days ?? null;
      if (horizonDays && horizonDays > 0) {
        const maxDate = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000);
        if (new Date(start_iso) > maxDate) {
          return json({
            error: "Datum valt buiten de boekingshorizon",
            error_code: "beyond_booking_horizon",
            field: "date",
            max_booking_date: maxDate.toISOString().slice(0, 10),
            horizon_days: horizonDays,
          }, 400);
        }
      }

      // Opening hours / closures / special days validation
      const ohErr = await validateOpeningHours(supabase, restaurant.id, tz, start_iso, end_iso);
      if (ohErr) return json(ohErr, 400);
    }

    // For online bookings only: exclude tables in zones that are not bookable online.
    // Operator channels (manager/walk_in/phone/ai_host/clickwise/import) keep full table access.
    let excludedTableIds: Set<string> | undefined;
    if (channel === "online") {
      const { data: offlineZones } = await supabase
        .from("zones").select("id")
        .eq("restaurant_id", restaurant.id)
        .eq("bookable_online", false);
      const excludedZoneIds = (offlineZones ?? []).map((z: { id: string }) => z.id);
      if (excludedZoneIds.length > 0) {
        const { data: excTables } = await supabase
          .from("tables").select("id")
          .eq("restaurant_id", restaurant.id)
          .in("zone_id", excludedZoneIds);
        excludedTableIds = new Set((excTables ?? []).map((t: { id: string }) => t.id));
      }
    }

    // Find fitting individual tables (zone_id + fill_priority nodig voor strategie)
    const { data: tables } = await supabase
      .from("tables").select("id, zone_id, capacity_min, capacity_max, fill_priority, label")
      .eq("restaurant_id", restaurant.id).eq("is_active", true)
      .lte("capacity_min", body.party_size).gte("capacity_max", body.party_size)
      .order("capacity_max", { ascending: true });

    const fittingTables = (tables ?? []).filter(
      (t: { id: string }) => !excludedTableIds || !excludedTableIds.has(t.id),
    );

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

    // === Fill strategy (feature-flag per restaurant) ===
    let chosenTableIds: string[] = [];
    let chosenCombinationId: string | null = null;
    let terracePreferenceUnmet = false;
    const fillStrategyOn = restaurant.fill_strategy_enabled === true
      && (channel === "online" || channel === "ai_host" || channel === "phone");

    let pickedZoneId: string | null = null;

    // Operator override: honor preselected table for walk_in / manager.
    const preselectedTableId = body.preselected_table_id;
    const isOperatorChannel = channel === "walk_in" || channel === "manager";
    if (preselectedTableId && isOperatorChannel) {
      const { data: pt } = await supabase.from("tables")
        .select("id, is_active, restaurant_id")
        .eq("id", preselectedTableId).maybeSingle();
      if (!pt || pt.restaurant_id !== restaurant.id || !pt.is_active) {
        return json({ error: "Gekozen tafel niet beschikbaar", error_code: "preselected_table_unavailable", field: "table_id" }, 409);
      }
      if (occupied.has(preselectedTableId)) {
        return json({ error: "Deze tafel is net bezet — kies een andere.", error_code: "preselected_table_unavailable", field: "table_id" }, 409);
      }
      chosenTableIds = [preselectedTableId];
      terracePreferenceUnmet = !!body.prefers_terrace;
    } else if (fillStrategyOn) {
      // Haal zones + alle actieve tafels (voor zone-bezetting) + weer (optioneel)
      const [{ data: zonesRaw }, { data: allTables }, { data: weatherRow }] = await Promise.all([
        supabase.from("zones").select("*").eq("restaurant_id", restaurant.id),
        supabase.from("tables").select("id, zone_id, is_active").eq("restaurant_id", restaurant.id).eq("is_active", true),
        supabase.from("weather_forecasts").select("min_temp_c, max_temp_c, precipitation_mm")
          .eq("restaurant_id", restaurant.id).eq("date", body.date).maybeSingle(),
      ]);

      const zones = (zonesRaw ?? []) as ZoneRow[];
      const weather = (weatherRow ?? null) as WeatherRow | null;
      const zoneActivity = resolveActiveZones({
        zones, partySize: body.party_size, startIso: start_iso, timezone: tz, weather,
      });

      // Occupancy per zone: tel actieve tafels en bezette tafels per zone
      const occupancyByZone = new Map<string, { occupied: number; total: number }>();
      for (const z of zones) occupancyByZone.set(z.id, { occupied: 0, total: 0 });
      for (const t of (allTables ?? []) as Array<{ id: string; zone_id: string | null }>) {
        if (!t.zone_id) continue;
        const entry = occupancyByZone.get(t.zone_id);
        if (!entry) continue;
        entry.total += 1;
        if (occupied.has(t.id)) entry.occupied += 1;
      }

      const freeFitting = fittingTables.filter((t: { id: string }) => !occupied.has(t.id)) as FillTableRow[];
      const picked = pickTableWithFillStrategy({
        fittingFreeTables: freeFitting,
        zoneActivity,
        occupancyByZone,
        prefersTerrace: !!body.prefers_terrace,
        partySize: body.party_size,
      });

      if (picked) {
        chosenTableIds = [picked.tableId];
        pickedZoneId = picked.zoneId;
        terracePreferenceUnmet = picked.terrace_preference_unmet;
      } else {
        // Combinatie-fallback met zone-bewuste strategie
        const { data: combosRaw } = await supabase
          .from("table_combinations")
          .select("id, name, table_ids, capacity_min, capacity_max, fill_priority, is_active")
          .eq("restaurant_id", restaurant.id).eq("is_active", true);
        const combinations = (combosRaw ?? []) as CombinationRow[];
        const allComboTableIds = Array.from(new Set(combinations.flatMap((c) => c.table_ids ?? [])));
        const tablesById = new Map<string, FillTableRow>();
        if (allComboTableIds.length > 0) {
          const { data: comboTables } = await supabase
            .from("tables").select("id, zone_id, capacity_min, capacity_max, fill_priority, label")
            .in("id", allComboTableIds);
          for (const t of (comboTables ?? []) as FillTableRow[]) tablesById.set(t.id, t);
        }
        // Filter cross-restaurant / inactieve excludes (online widget)
        const filteredCombos = excludedTableIds
          ? combinations.filter((c) => !(c.table_ids ?? []).some((id) => excludedTableIds!.has(id)))
          : combinations;
        const pickedCombo = pickCombinationWithFillStrategy({
          combinations: filteredCombos,
          tablesById,
          occupiedTableIds: occupied,
          zoneActivity,
          prefersTerrace: !!body.prefers_terrace,
          partySize: body.party_size,
        });
        if (!pickedCombo) {
          return json({ error: "Geen tafel of combinatie beschikbaar voor deze groepsgrootte op dit moment", error_code: "no_table_available", field: "party_size" }, 409);
        }
        chosenTableIds = pickedCombo.tableIds;
        chosenCombinationId = pickedCombo.combinationId;
        terracePreferenceUnmet = pickedCombo.terrace_preference_unmet;
      }
    } else {
      // Legacy: eerste vrije fitting tafel
      const candidate = fittingTables.find((t: { id: string }) => !occupied.has(t.id)) ?? null;
      if (candidate) {
        chosenTableIds = [candidate.id];
      } else {
        const combo = await findAvailableCombination(
          supabase, restaurant.id, body.party_size, start_iso, end_iso, undefined, excludedTableIds,
        );
        if (!combo) {
          return json({ error: "Geen tafel of combinatie beschikbaar voor deze groepsgrootte op dit moment", error_code: "no_table_available", field: "party_size" }, 409);
        }
        chosenTableIds = combo.tableIds;
        chosenCombinationId = combo.combinationId;
      }
      terracePreferenceUnmet = !!body.prefers_terrace;
    }
    void pickedZoneId; // reserved for future logging


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
    //
    // Two-threshold model (same for widget & voice agent):
    //   party < largeFrom        → normal
    //   party >= largeFrom       → large group  (manual only if ≥ manualFrom)
    //   party >= xlFrom          → extra-large  (ALWAYS manual)
    const manualApprovalSize: number | null = restaurant.manual_approval_from_party_size ?? null;
    const largeFrom: number = restaurant.large_group_threshold ?? 9;
    const xlFrom: number | null = restaurant.extra_large_group_threshold ?? null;
    const largeGroupManualFrom: number = restaurant.large_group_manual_approval_from ?? largeFrom;

    let requiresManualApproval = false;
    let largeGroupStatus: string | null = null;

    if (xlFrom !== null && body.party_size >= xlFrom) {
      requiresManualApproval = true;
      largeGroupStatus = "awaiting_approval";
    } else if (isLargeGroup) {
      if (body.party_size >= largeGroupManualFrom) {
        requiresManualApproval = true;
        largeGroupStatus = "awaiting_approval";
      }
      // Geen 'approved' meer voor groepen die geen interne goedkeuring nodig hebben — gewoon null laten.
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
      prefers_terrace: !!body.prefers_terrace,
      terrace_preference_unmet: terracePreferenceUnmet,
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

    // Re-check race condition across ALL chosen tables.
    // Bij gelijktijdige inserts moet maar één winnen: gebruik (created_at, id) als
    // deterministische tiebreaker (vroegste reservering wint). Zonder dit zou
    // ieder van N parallelle inserts de anderen als "conflict" zien en zichzelf
    // rollbacken → 0 succesvolle boekingen.
    const { data: doubleCheck } = await supabase
      .from("reservation_tables")
      .select("reservation_id, table_id, reservations!inner(start_time, end_time, status, hold_expires_at, created_at)")
      .in("table_id", chosenTableIds);
    const conflicts = ((doubleCheck ?? []) as unknown as Array<{
      reservation_id: string;
      table_id: string;
      reservations: { start_time: string; end_time: string; status: string; hold_expires_at: string | null; created_at: string } | null;
    }>).filter((row) => {
      if (row.reservation_id === reservation.id) return false;
      const r = row.reservations;
      if (!r) return false;
      if (!ACTIVE_STATUSES.includes(r.status as typeof ACTIVE_STATUSES[number])) return false;
      if (r.status === "hold" && (!r.hold_expires_at || new Date(r.hold_expires_at) <= now)) return false;
      return intervalsOverlap(start_iso, end_iso, r.start_time, r.end_time);
    });
    if (conflicts.length > 0) {
      const ourCreated = reservation.created_at as string;
      const ourId = reservation.id as string;
      const weLose = conflicts.some((c) => {
        const oc = c.reservations!.created_at;
        if (oc < ourCreated) return true;
        if (oc === ourCreated && c.reservation_id < ourId) return true;
        return false;
      });
      if (weLose) {
        await supabase.from("reservation_tables").delete().eq("reservation_id", reservation.id);
        await supabase.from("reservations").delete().eq("id", reservation.id);
        return json({ error: "Slot net bezet door een andere reservering, probeer opnieuw", error_code: "slot_unavailable", field: "time", retry: true }, 409);
      }
      // Wij zijn de winnaar — verliezers rollbacken zichzelf in hun eigen request.
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

    // Spiegel grote-groep-aanvragen ook in large_group_requests zodat rapportages
    // en de "aanvragen-inbox" deze reserveringen meenemen. Gekoppeld via reservation_id.
    if (requiresManualApproval && largeGroupStatus === "awaiting_approval") {
      const contactName = [body.guest.first_name, body.guest.last_name].filter(Boolean).join(" ").trim() || "Onbekend";
      await supabase.from("large_group_requests").insert({
        restaurant_id: restaurant.id,
        reservation_id: reservation.id,
        contact_name: contactName,
        contact_phone: body.guest.phone ?? null,
        contact_email: body.guest.email ?? null,
        party_size: body.party_size,
        preferred_date: body.date,
        preferred_time: body.time,
        occasion: body.occasion ?? null,
        message: [
          body.special_requests ? String(body.special_requests) : null,
          `[bron: ${channel}]`,
        ].filter(Boolean).join("\n\n"),
        status: "new",
      }).then(() => {}, (e) => console.warn("large_group_requests mirror insert failed", e));
    }

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
        // JWT meer voor de gateway. We gebruiken de publieke anon/publishable key
        // (klassieke JWT) via environment-variabelen — geen hardcoded token.
        const anonKey =
          Deno.env.get("SUPABASE_GATEWAY_JWT_ANON_KEY") ??
          Deno.env.get("SUPABASE_ANON_KEY") ??
          Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        if (!anonKey) {
          console.error("guest confirmation email skipped: missing anon gateway key");
        } else {
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
        }
      } catch (mailErr) {
        console.error("guest confirmation email failed (non-fatal)", mailErr);
      }
    }

    // Gastvriendelijke melding voor voice-agent bij grote-groep goedkeuring.
    // Tenant-driven copy heeft voorrang; anders bouw een zin uit de tenant-specifieke
    // SLA/kanaal-labels. Beide leeg => neutrale fallback zonder belofte.
    const tenantPendingCopy = (restaurant.large_group_confirmation_text ?? "").toString().trim();
    const slaLabel = (restaurant.large_group_response_sla_label ?? "").toString().trim();
    const channelLabel = (restaurant.large_group_response_channel_label ?? "").toString().trim();
    const dynamicTail = slaLabel && channelLabel
      ? ` U ontvangt ${slaLabel} een bericht ${channelLabel}.`
      : slaLabel ? ` U ontvangt ${slaLabel} een bericht.`
      : channelLabel ? ` U ontvangt een bericht ${channelLabel}.`
      : ` Het restaurant laat het u zo snel mogelijk weten.`;
    const fallbackPending = `Uw reservering voor ${body.party_size} personen op ${body.date} om ${body.time} is voorlopig genoteerd.${dynamicTail}`;
    const messageForGuest = requiresManualApproval
      ? (tenantPendingCopy || fallbackPending)
      : null;

    return json({
      ok: true,
      // Top-level vlaggen — voice-agent/ClickWise hoeven niet door reservation.* te graven
      requires_manual_approval: requiresManualApproval,
      large_group_status: largeGroupStatus,
      message_for_guest: messageForGuest,
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
        requires_manual_approval: requiresManualApproval,
        large_group_status: largeGroupStatus,
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

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Server-side beslissing of de voice agent NU mag doorverbinden bij een te grote groep.
 * Voorkomt dat de LLM zelf "huidige tijd" en vrije-tekst venster moet interpreteren.
 */
async function computeTransferAvailability(
  supabase: ReturnType<typeof createClient>,
  restaurant: any,
): Promise<{
  allowed: boolean;
  phone: string | null;
  hours_label: string | null;
  reason: "no_phone" | "no_hours" | "closed_day" | "outside_hours" | null;
  current_time_local: string | null;
}> {
  const phone: string | null = restaurant.transfer_phone ?? null;
  const start: string | null = restaurant.transfer_hours_start ?? null;
  const end: string | null = restaurant.transfer_hours_end ?? null;
  const tz: string = restaurant.timezone || "Europe/Amsterdam";

  // Format current local time in restaurant tz
  const fmt = new Intl.DateTimeFormat("nl-NL", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const currentLocal = `${hh}:${mm}`;

  // Weekday index in tz (0=sun…6=sat)
  const wdFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
  const wdShort = wdFmt.format(new Date()).toLowerCase().slice(0, 3); // mon, tue …
  const weekdayKey = wdShort === "sun" ? "sun" : wdShort;

  const hoursLabel = start && end ? `${start.slice(0, 5)}–${end.slice(0, 5)}` : null;

  if (!phone) return { allowed: false, phone: null, hours_label: hoursLabel, reason: "no_phone", current_time_local: currentLocal };
  if (!start || !end) return { allowed: false, phone, hours_label: null, reason: "no_hours", current_time_local: currentLocal };

  // Opening hours check: if today explicitly is_closed → don't transfer
  try {
    const { data: oh } = await supabase
      .from("opening_hours")
      .select("weekday, is_closed")
      .eq("restaurant_id", restaurant.id)
      .eq("weekday", weekdayKey)
      .maybeSingle();
    if (oh?.is_closed) {
      return { allowed: false, phone, hours_label: hoursLabel, reason: "closed_day", current_time_local: currentLocal };
    }
  } catch { /* opening_hours absent: don't block */ }

  // Compare HH:MM strings
  const inWindow = currentLocal >= start.slice(0, 5) && currentLocal <= end.slice(0, 5);
  if (!inWindow) return { allowed: false, phone, hours_label: hoursLabel, reason: "outside_hours", current_time_local: currentLocal };

  return { allowed: true, phone, hours_label: hoursLabel, reason: null, current_time_local: currentLocal };
}

/**
 * Valideer of het gevraagde tijdvenster binnen openingstijden valt.
 * Special_days override opening_hours; closures (full-day of partial) blokkeren altijd.
 * Retourneert null als alles ok is, anders een error-object voor json().
 */
async function validateOpeningHours(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  tz: string,
  startIso: string,
  endIso: string,
): Promise<Record<string, unknown> | null> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const localOf = (d: Date) => {
    const p = fmt.formatToParts(d);
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
    return {
      date: `${g("year")}-${g("month")}-${g("day")}`,
      time: `${g("hour")}:${g("minute")}`,
      weekday: g("weekday").toLowerCase().slice(0, 3),
    };
  };
  const sLocal = localOf(new Date(startIso));
  const eLocal = localOf(new Date(endIso));

  // Closures (date-range; full-day or partial)
  const { data: closures } = await supabase
    .from("closures")
    .select("is_full_day, start_time, end_time, reason")
    .eq("restaurant_id", restaurantId)
    .lte("start_date", sLocal.date)
    .gte("end_date", sLocal.date);
  for (const c of (closures ?? []) as Array<{ is_full_day: boolean; start_time: string | null; end_time: string | null; reason: string | null }>) {
    if (c.is_full_day) {
      return { error: "Restaurant is gesloten op deze datum", error_code: "closed_day", field: "date", reason: c.reason ?? null };
    }
    if (c.start_time && c.end_time) {
      const cs = c.start_time.slice(0, 5);
      const ce = c.end_time.slice(0, 5);
      if (sLocal.time < ce && eLocal.time > cs) {
        return { error: "Restaurant is gesloten op dit tijdstip", error_code: "closed_time", field: "time", closure_start: cs, closure_end: ce };
      }
    }
  }

  // Special day override
  let openHHMM: string | null = null;
  let closeHHMM: string | null = null;
  const { data: special } = await supabase
    .from("special_days")
    .select("is_closed, opens_at, closes_at")
    .eq("restaurant_id", restaurantId)
    .eq("date", sLocal.date)
    .maybeSingle();
  if (special) {
    if (special.is_closed) {
      return { error: "Restaurant is gesloten op deze datum", error_code: "closed_day", field: "date" };
    }
    if (special.opens_at && special.closes_at) {
      openHHMM = String(special.opens_at).slice(0, 5);
      closeHHMM = String(special.closes_at).slice(0, 5);
    }
  }

  // Reguliere weekdag-openingstijden
  if (openHHMM === null || closeHHMM === null) {
    const { data: oh } = await supabase
      .from("opening_hours")
      .select("is_closed, open_time, close_time")
      .eq("restaurant_id", restaurantId)
      .eq("weekday", sLocal.weekday)
      .maybeSingle();
    if (oh) {
      if (oh.is_closed) {
        return { error: "Restaurant is gesloten op deze dag", error_code: "closed_day", field: "date" };
      }
      openHHMM = oh.open_time ? String(oh.open_time).slice(0, 5) : null;
      closeHHMM = oh.close_time ? String(oh.close_time).slice(0, 5) : null;
    }
  }

  if (openHHMM && closeHHMM) {
    if (sLocal.time < openHHMM || sLocal.time >= closeHHMM) {
      return {
        error: "Tijdstip valt buiten openingstijden",
        error_code: "outside_opening_hours",
        field: "time",
        open_time: openHHMM,
        close_time: closeHHMM,
      };
    }
  }
  return null;
}
