// Availability edge function — returns available time slots for a date + party size.
// Public endpoint (used by guest widget). No auth required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  WEEKDAY_KEYS, getWeekdayKey, zonedDateTimeToUtcIso, addMinutesIso,
  intervalsOverlap, ACTIVE_STATUSES,
} from "../_shared/reservation-utils.ts";
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

    // Large group check
    if (body.party_size > restaurant.max_party_size_online) {
      return json({
        slots: [],
        large_group: true,
        large_group_threshold: restaurant.max_party_size_online,
        message: `Voor groepen vanaf ${restaurant.large_group_threshold} personen vragen we een aparte aanvraag.`,
      });
    }

    const tz: string = restaurant.timezone || "Europe/Amsterdam";
    const slotMinutes: number = restaurant.slot_duration_minutes || 15;
    const durationMinutes: number = restaurant.default_reservation_minutes || 105;

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

    // Fetch tables that fit party size
    const { data: tables } = await supabase
      .from("tables").select("id, capacity_min, capacity_max")
      .eq("restaurant_id", restaurant.id).eq("is_active", true)
      .lte("capacity_min", body.party_size).gte("capacity_max", body.party_size);

    const fittingTableIds = (tables ?? []).map((t) => t.id);

    // Fetch active reservations on this date (broad window, then filter)
    const dayStartIso = zonedDateTimeToUtcIso(body.date, "00:00", tz);
    const dayEndIso = addMinutesIso(dayStartIso, 24 * 60 + durationMinutes);
    const { data: existingRes } = await supabase
      .from("reservations")
      .select("id, start_time, end_time, status, hold_expires_at, reservation_tables(table_id)")
      .eq("restaurant_id", restaurant.id)
      .gte("start_time", dayStartIso).lt("start_time", dayEndIso)
      .in("status", ACTIVE_STATUSES as unknown as string[]);

    const now = new Date();
    const liveRes = (existingRes ?? []).filter((r) =>
      r.status !== "hold" || (r.hold_expires_at && new Date(r.hold_expires_at) > now)
    );

    // For each slot determine free fitting tables
    const slots: Slot[] = slotCandidates.map((slot) => {
      const conflicting = new Set<string>();
      for (const r of liveRes) {
        if (intervalsOverlap(slot.start_iso, slot.end_iso, r.start_time, r.end_time)) {
          for (const rt of (r.reservation_tables ?? [])) conflicting.add(rt.table_id);
        }
      }
      const free = fittingTableIds.filter((id) => !conflicting.has(id));
      return {
        time: slot.time,
        start_iso: slot.start_iso,
        end_iso: slot.end_iso,
        available: free.length > 0,
        available_table_count: free.length,
      };
    });

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
