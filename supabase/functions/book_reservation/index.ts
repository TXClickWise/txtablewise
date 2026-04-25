// Book reservation — atomic, with table assignment + conflict re-check.
// Public endpoint (used by guest widget). Channel defaults to 'online'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  zonedDateTimeToUtcIso, addMinutesIso, intervalsOverlap, ACTIVE_STATUSES,
} from "../_shared/reservation-utils.ts";
import { evaluatePacing, type PacingReservation } from "../_shared/pacing.ts";

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
    if (!body?.date || !body?.time || !body?.party_size || !body?.guest?.email || !body?.guest?.first_name) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!(body.restaurant_id || body.restaurant_slug)) return json({ error: "Restaurant required" }, 400);
    if (body.party_size < 1 || body.party_size > 50) return json({ error: "Invalid party_size" }, 400);
    if (!/^\S+@\S+\.\S+$/.test(body.guest.email)) return json({ error: "Invalid email" }, 400);

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

    if (body.party_size > restaurant.max_party_size_online && body.channel !== "manager") {
      return json({ error: "Party size exceeds online limit", large_group: true }, 400);
    }

    const tz: string = restaurant.timezone;
    const defaultMinutes: number = restaurant.default_reservation_minutes || 105;
    const largeGroupMinutes: number = restaurant.large_group_minutes || 150;
    const largeGroupThreshold: number = restaurant.large_group_threshold || 9;
    const durationMinutes: number =
      body.party_size >= largeGroupThreshold ? largeGroupMinutes : defaultMinutes;
    const start_iso = zonedDateTimeToUtcIso(body.date, body.time, tz);
    const end_iso = addMinutesIso(start_iso, durationMinutes);

    if (new Date(start_iso) < new Date(Date.now() + (restaurant.booking_lead_time_minutes ?? 0) * 60_000)) {
      return json({ error: "Slot too soon" }, 400);
    }

    // Find fitting tables
    const { data: tables } = await supabase
      .from("tables").select("id, capacity_min, capacity_max")
      .eq("restaurant_id", restaurant.id).eq("is_active", true)
      .lte("capacity_min", body.party_size).gte("capacity_max", body.party_size)
      .order("capacity_max", { ascending: true });

    if (!tables || tables.length === 0) {
      return json({ error: "Geen passende tafel beschikbaar voor deze groepsgrootte" }, 409);
    }

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
    const candidate = tables.find((t) => !occupied.has(t.id));
    if (!candidate) return json({ error: "Geen tafel meer beschikbaar voor dit moment", retry: true }, 409);

    // Upsert guest by (restaurant_id, email)
    let guestId: string | null = null;
    const { data: existingGuest } = await supabase
      .from("guests").select("id")
      .eq("restaurant_id", restaurant.id).eq("email", body.guest.email).maybeSingle();
    if (existingGuest) {
      guestId = existingGuest.id;
      await supabase.from("guests").update({
        first_name: body.guest.first_name,
        last_name: body.guest.last_name ?? null,
        phone: body.guest.phone ?? null,
        language: body.guest.language ?? "nl",
        marketing_consent: body.marketing_consent ?? false,
      }).eq("id", guestId);
    } else {
      const { data: newGuest, error: gErr } = await supabase.from("guests").insert({
        restaurant_id: restaurant.id,
        first_name: body.guest.first_name,
        last_name: body.guest.last_name ?? null,
        phone: body.guest.phone ?? null,
        email: body.guest.email,
        language: body.guest.language ?? "nl",
        marketing_consent: body.marketing_consent ?? false,
      }).select("id").single();
      if (gErr) return json({ error: gErr.message }, 500);
      guestId = newGuest.id;
    }

    const channel = body.channel ?? "online";
    const status = body.hold_only ? "hold" : "confirmed";
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
    }).select("*").single();

    if (resErr) return json({ error: resErr.message }, 500);

    // Link table
    const { error: rtErr } = await supabase.from("reservation_tables").insert({
      reservation_id: reservation.id, table_id: candidate.id,
    });
    if (rtErr) {
      // Rollback the reservation
      await supabase.from("reservations").delete().eq("id", reservation.id);
      return json({ error: "Failed to assign table: " + rtErr.message }, 500);
    }

    // Re-check for race condition: did another reservation take this table in the same window?
    const { data: doubleCheck } = await supabase
      .from("reservation_tables")
      .select("reservation_id, reservations!inner(start_time, end_time, status, hold_expires_at)")
      .eq("table_id", candidate.id);
    const conflicts = ((doubleCheck ?? []) as unknown as Array<{
      reservation_id: string;
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
      // Rollback
      await supabase.from("reservation_tables").delete().eq("reservation_id", reservation.id);
      await supabase.from("reservations").delete().eq("id", reservation.id);
      return json({ error: "Slot net bezet door een andere reservering, probeer opnieuw", retry: true }, 409);
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
        guest: { email: body.guest.email, first_name: body.guest.first_name },
      },
    });

    return json({
      ok: true,
      reservation: {
        id: reservation.id,
        confirmation_code: confirmationCode,
        status,
        start_time: start_iso,
        end_time: end_iso,
        party_size: body.party_size,
        table_id: candidate.id,
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
