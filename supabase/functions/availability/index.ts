// Availability edge function — returns available time slots for a date + party size.
// Public endpoint (used by guest widget). No auth required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  WEEKDAY_KEYS, getWeekdayKey, zonedDateTimeToUtcIso, addMinutesIso,
  intervalsOverlap, ACTIVE_STATUSES, findAvailableCombination,
} from "../_shared/reservation-utils.ts";
import {
  resolveActiveZones, pickCombinationWithFillStrategy,
  type ZoneRow, type TableRow as FillTableRow, type WeatherRow, type CombinationRow,
} from "../_shared/zone-fill.ts";
import { evaluatePacing, durationFor, type PacingReservation } from "../_shared/pacing.ts";

type AvailabilityRequest = {
  restaurant_id?: string;
  restaurant_slug?: string;
  date: string;       // YYYY-MM-DD
  party_size: number;
};

type Slot = {
  time: string;       // HH:MM in restaurant timezone
  start_iso: string;  // UTC ISO
  end_iso: string;    // UTC ISO
  available: boolean;
  available_table_count: number;
  is_combination?: boolean;
  peak_warning?: boolean;
  reason?: "covers_full" | "rate_full" | "no_table";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as AvailabilityRequest;
    if (!body?.date || !body?.party_size || (!body.restaurant_id && !body.restaurant_slug)) {
      return json({ error: "Missing fields" }, 400);
    }
    if (body.party_size < 1 || body.party_size > 50) {
      return json({ error: "Invalid party_size" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve restaurant
    const restQuery = body.restaurant_id
      ? supabase.from("restaurants").select("*").eq("id", body.restaurant_id).maybeSingle()
      : supabase.from("restaurants").select("*").eq("slug", body.restaurant_slug!).maybeSingle();
    const { data: restaurant, error: rErr } = await restQuery;
    if (rErr) return json({ error: rErr.message }, 500);
    if (!restaurant) return json({ error: "Restaurant not found" }, 404);

    // Online request hard cap: large_group_max_online_request (falls back to max_party_size_online)
    const onlineHardCap: number = restaurant.large_group_max_online_request ?? restaurant.max_party_size_online;
    if (body.party_size > onlineHardCap) {
      return json({
        slots: [],
        large_group: true,
        large_group_threshold: restaurant.max_party_size_online,
        message: `Voor groepen groter dan ${onlineHardCap} personen vragen we een aparte aanvraag.`,
      });
    }

    const tz: string = restaurant.timezone || "Europe/Amsterdam";
    const slotMinutes: number = restaurant.slot_duration_minutes || 15;
    const durationMinutes: number = durationFor(body.party_size, {
      default_minutes: restaurant.default_reservation_minutes ?? 105,
      large_group_minutes: restaurant.large_group_minutes ?? 150,
      large_group_threshold: restaurant.large_group_threshold ?? 9,
      extra_large_group_threshold: restaurant.extra_large_group_threshold ?? null,
      large_group_extra_minutes: restaurant.large_group_extra_minutes ?? 0,
    });

    const pacingConfig = {
      max_covers_per_slot: restaurant.max_covers_per_slot ?? null,
      max_new_reservations_per_15min: restaurant.max_new_reservations_per_15min ?? null,
      peak_warning_threshold_pct: restaurant.peak_warning_threshold_pct ?? 85,
    };


    // Determine weekday in restaurant tz for the requested date (use noon to avoid DST edge)
    const noonUtc = new Date(zonedDateTimeToUtcIso(body.date, "12:00", tz));
    const weekday = getWeekdayKey(noonUtc, tz);

    // Closures
    const { data: closures } = await supabase
      .from("closures").select("*")
      .eq("restaurant_id", restaurant.id)
      .lte("start_date", body.date).gte("end_date", body.date);

    const fullDayClosed = (closures ?? []).some((c) => c.is_full_day);
    if (fullDayClosed) return json({ slots: [], closed: true, message: "Gesloten op deze dag." });

    // Opening hours for that weekday
    const { data: hours } = await supabase
      .from("opening_hours").select("*")
      .eq("restaurant_id", restaurant.id).eq("weekday", weekday).eq("is_closed", false);

    // Shifts active that weekday
    const { data: shifts } = await supabase
      .from("shifts").select("*")
      .eq("restaurant_id", restaurant.id).eq("is_active", true);
    const activeShifts = (shifts ?? []).filter((s) => (s.weekdays ?? []).includes(weekday));

    // Build candidate windows: intersect opening hours with shifts (if shifts defined, else just opening hours)
    type Window = { start: string; end: string };
    const windows: Window[] = [];
    const baseWindows: Window[] = (hours ?? []).map((h) => ({ start: h.open_time.slice(0, 5), end: h.close_time.slice(0, 5) }));
    if (activeShifts.length > 0) {
      for (const base of baseWindows) {
        for (const s of activeShifts) {
          const start = maxTime(base.start, s.start_time.slice(0, 5));
          const end = minTime(base.end, s.end_time.slice(0, 5));
          if (start < end) windows.push({ start, end });
        }
      }
    } else {
      windows.push(...baseWindows);
    }

    // Sorteer en merge aansluitende/overlappende vensters (lunch 11-17 + diner 17-22 → 11-22)
    windows.sort((a, b) => a.start.localeCompare(b.start));
    const mergedWindows: Window[] = [];
    for (const w of windows) {
      const last = mergedWindows[mergedWindows.length - 1];
      if (last && w.start <= last.end) {
        if (w.end > last.end) last.end = w.end;
      } else {
        mergedWindows.push({ ...w });
      }
    }
    windows.length = 0;
    windows.push(...mergedWindows);

    if (windows.length === 0) return json({ slots: [], closed: true, message: "Geen openingstijden voor deze dag." });

    // Apply partial closures (time-bound)
    const partialClosures = (closures ?? []).filter((c) => !c.is_full_day && c.start_time && c.end_time);

    // Generate slot candidates
    const slotCandidates: { time: string; start_iso: string; end_iso: string }[] = [];
    for (const w of windows) {
      let cur = toMinutes(w.start);
      const lastStart = toMinutes(w.end) - durationMinutes;
      while (cur <= lastStart) {
        const tStr = fromMinutes(cur);
        const start_iso = zonedDateTimeToUtcIso(body.date, tStr, tz);
        const end_iso = addMinutesIso(start_iso, durationMinutes);

        // Skip past slots (with lead time)
        const minStart = new Date(Date.now() + (restaurant.booking_lead_time_minutes ?? 0) * 60_000);
        if (new Date(start_iso) < minStart) { cur += slotMinutes; continue; }

        // Skip if inside a partial closure
        const inPartialClosure = partialClosures.some((c) => {
          const cs = zonedDateTimeToUtcIso(body.date, c.start_time.slice(0, 5), tz);
          const ce = zonedDateTimeToUtcIso(body.date, c.end_time.slice(0, 5), tz);
          return intervalsOverlap(start_iso, end_iso, cs, ce);
        });
        if (inPartialClosure) { cur += slotMinutes; continue; }

        slotCandidates.push({ time: tStr, start_iso, end_iso });
        cur += slotMinutes;
      }
    }

    // Fetch zones that are NOT bookable online — used to exclude their tables
    const { data: offlineZones } = await supabase
      .from("zones").select("id")
      .eq("restaurant_id", restaurant.id)
      .eq("bookable_online", false);
    const excludedZoneIds = new Set((offlineZones ?? []).map((z: { id: string }) => z.id));

    // Fetch tables that fit party size
    const { data: tables } = await supabase
      .from("tables").select("id, capacity_min, capacity_max, zone_id")
      .eq("restaurant_id", restaurant.id).eq("is_active", true)
      .lte("capacity_min", body.party_size).gte("capacity_max", body.party_size);

    const fittingTableIds = (tables ?? [])
      .filter((t: { zone_id: string | null }) => !t.zone_id || !excludedZoneIds.has(t.zone_id))
      .map((t: { id: string }) => t.id);

    // For combination fallback: build excluded-table set (all tables in offline zones)
    let excludedTableIds: Set<string> | undefined;
    if (excludedZoneIds.size > 0) {
      const { data: excTables } = await supabase
        .from("tables").select("id")
        .eq("restaurant_id", restaurant.id)
        .in("zone_id", Array.from(excludedZoneIds));
      excludedTableIds = new Set((excTables ?? []).map((t: { id: string }) => t.id));
    }


    // Fetch active reservations on this date (broad window, then filter)
    const dayStartIso = zonedDateTimeToUtcIso(body.date, "00:00", tz);
    const dayEndIso = addMinutesIso(dayStartIso, 24 * 60 + durationMinutes);
    const { data: existingRes } = await supabase
      .from("reservations")
      .select("id, start_time, end_time, party_size, status, hold_expires_at, reservation_tables(table_id)")
      .eq("restaurant_id", restaurant.id)
      .gte("start_time", dayStartIso).lt("start_time", dayEndIso)
      .in("status", ACTIVE_STATUSES as unknown as string[]);

    const now = new Date();
    const liveRes = (existingRes ?? []).filter((r) =>
      r.status !== "hold" || (r.hold_expires_at && new Date(r.hold_expires_at) > now)
    );

    const pacingRows: PacingReservation[] = liveRes.map((r) => ({
      id: r.id,
      start_time: r.start_time,
      end_time: r.end_time,
      party_size: r.party_size ?? 0,
      status: r.status,
      hold_expires_at: r.hold_expires_at,
    }));

    // Pre-fetch combinatie-metadata en weer voor fill-strategie combinatie-pick.
    // Zo blijft availability consistent met book_reservation wanneer fill_strategy_enabled aanstaat.
    const fillStrategyOn = restaurant.fill_strategy_enabled === true;
    let comboFillCtx:
      | {
          combinations: CombinationRow[];
          tablesById: Map<string, FillTableRow>;
          zones: ZoneRow[];
          weather: WeatherRow | null;
        }
      | null = null;
    if (fillStrategyOn) {
      const [{ data: combosRaw }, { data: zonesRaw }, { data: weatherRow }] = await Promise.all([
        supabase.from("table_combinations")
          .select("id, name, table_ids, capacity_min, capacity_max, fill_priority, is_active")
          .eq("restaurant_id", restaurant.id).eq("is_active", true),
        supabase.from("zones").select("*").eq("restaurant_id", restaurant.id),
        supabase.from("weather_forecasts").select("min_temp_c, max_temp_c, precipitation_mm")
          .eq("restaurant_id", restaurant.id).eq("date", body.date).maybeSingle(),
      ]);
      const combinations = (combosRaw ?? []) as CombinationRow[];
      const allComboTableIds = Array.from(new Set(combinations.flatMap((c) => c.table_ids ?? [])));
      const tablesById = new Map<string, FillTableRow>();
      if (allComboTableIds.length > 0) {
        const { data: comboTables } = await supabase
          .from("tables").select("id, zone_id, capacity_min, capacity_max, fill_priority, label")
          .in("id", allComboTableIds);
        for (const t of (comboTables ?? []) as FillTableRow[]) tablesById.set(t.id, t);
      }
      comboFillCtx = {
        combinations,
        tablesById,
        zones: (zonesRaw ?? []) as ZoneRow[],
        weather: (weatherRow ?? null) as WeatherRow | null,
      };
    }

    // For each slot determine free fitting tables AND pacing.
    // If no individual table fits, try a table combination (best-fit fallback).
    const slots: Slot[] = await Promise.all(slotCandidates.map(async (slot) => {
      const conflicting = new Set<string>();
      for (const r of liveRes) {
        if (intervalsOverlap(slot.start_iso, slot.end_iso, r.start_time, r.end_time)) {
          for (const rt of (r.reservation_tables ?? [])) conflicting.add(rt.table_id);
        }
      }
      const free = fittingTableIds.filter((id) => !conflicting.has(id));
      const pacing = evaluatePacing(
        { start_iso: slot.start_iso, end_iso: slot.end_iso, party_size: body.party_size },
        pacingRows,
        pacingConfig,
      );
      let tableAvailable = free.length > 0;
      let isCombination = false;
      if (!tableAvailable) {
        if (comboFillCtx) {
          // Fill-strategie-bewuste combinatie-pick, gelijk aan book_reservation
          const zoneActivity = resolveActiveZones({
            zones: comboFillCtx.zones,
            partySize: body.party_size,
            startIso: slot.start_iso,
            timezone: tz,
            weather: comboFillCtx.weather,
          });
          const filteredCombos = excludedTableIds
            ? comboFillCtx.combinations.filter((c) => !(c.table_ids ?? []).some((id) => excludedTableIds!.has(id)))
            : comboFillCtx.combinations;
          const picked = pickCombinationWithFillStrategy({
            combinations: filteredCombos,
            tablesById: comboFillCtx.tablesById,
            occupiedTableIds: conflicting,
            zoneActivity,
            prefersTerrace: false,
            partySize: body.party_size,
          });
          if (picked) { tableAvailable = true; isCombination = true; }
        } else {
          const combo = await findAvailableCombination(
            supabase, restaurant.id, body.party_size, slot.start_iso, slot.end_iso, undefined, excludedTableIds,
          );
          if (combo) { tableAvailable = true; isCombination = true; }
        }
      }
      const available = tableAvailable && pacing.ok;
      return {
        time: slot.time,
        start_iso: slot.start_iso,
        end_iso: slot.end_iso,
        available,
        available_table_count: free.length,
        is_combination: isCombination || undefined,
        peak_warning: pacing.peak_warning,
        reason: !tableAvailable ? "no_table" : (!pacing.ok ? pacing.reason : undefined),
      };
    }));


    return json({
      slots,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        timezone: tz,
        max_party_size_online: restaurant.max_party_size_online,
        large_group_threshold: restaurant.large_group_threshold,
      },
    });
  } catch (e) {
    console.error("availability error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function toMinutes(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fromMinutes(n: number) { return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; }
function maxTime(a: string, b: string) { return toMinutes(a) >= toMinutes(b) ? a : b; }
function minTime(a: string, b: string) { return toMinutes(a) <= toMinutes(b) ? a : b; }
