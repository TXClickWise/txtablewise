// reminder_scheduler — periodieke check die integration_events aanmaakt voor:
//   - 24h reminders (reservations 22-26h vooruit)
//   - 2h reminders  (reservations 1.5-2.5h vooruit)
//   - reconfirmation requests (waar reconfirmation_status = 'required' en nog niet verstuurd)
//
// Geen externe API-calls. clickwise_process_event verwerkt de events later.
// Dedup: per (reservation_id, event_type) wordt slechts één event aangemaakt.
//
// Auth: deze function draait met verify_jwt = false. Optioneel kan een
// REMINDER_SCHEDULER_SECRET worden ingesteld; indien aanwezig moet die als
// X-Scheduler-Secret header worden meegestuurd.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCHEDULER_SECRET = Deno.env.get("REMINDER_SCHEDULER_SECRET") ?? "";

type Json = Record<string, unknown>;
function ok(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Reservation = {
  id: string;
  restaurant_id: string;
  status: string;
  start_time: string;
  party_size: number;
  guest_id: string | null;
  reservation_date: string;
  reconfirmation_status: string | null;
  reminder_sent_at: string | null;
};

async function eventExists(
  admin: ReturnType<typeof createClient>,
  reservationId: string,
  eventType: string,
): Promise<boolean> {
  const { data } = await admin
    .from("integration_events")
    .select("id")
    .eq("event_type", eventType)
    .contains("payload", { reservation_id: reservationId })
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function emit(
  admin: ReturnType<typeof createClient>,
  res: Reservation,
  eventType: string,
) {
  if (await eventExists(admin, res.id, eventType)) return false;
  await admin.from("integration_events").insert({
    restaurant_id: res.restaurant_id,
    event_type: eventType,
    target: "clickwise",
    entity_type: "reservation",
    entity_id: res.id,
    payload: {
      reservation_id: res.id,
      guest_id: res.guest_id,
      party_size: res.party_size,
      start_time: res.start_time,
      reservation_date: res.reservation_date,
      status: res.status,
    },
  });
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (SCHEDULER_SECRET) {
    const provided = req.headers.get("x-scheduler-secret") ?? "";
    if (provided !== SCHEDULER_SECRET) return ok({ ok: false, error: "unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const horizonEnd = new Date(now.getTime() + 26 * 3600 * 1000);

  const { data: rows, error } = await admin
    .from("reservations")
    .select("id, restaurant_id, status, start_time, party_size, guest_id, reservation_date, reconfirmation_status, reminder_sent_at")
    .in("status", ["pending", "confirmed"])
    .gte("start_time", now.toISOString())
    .lte("start_time", horizonEnd.toISOString());

  if (error) return ok({ ok: false, error: error.message }, 500);

  const reservations = (rows ?? []) as Reservation[];
  let created24 = 0, created2 = 0, createdReconfirm = 0;

  for (const r of reservations) {
    const start = new Date(r.start_time).getTime();
    const hoursAhead = (start - now.getTime()) / 3600000;

    if (hoursAhead >= 22 && hoursAhead <= 26) {
      if (await emit(admin, r, "reservation.reminder_24h_scheduled")) created24++;
    }
    if (hoursAhead >= 1.5 && hoursAhead <= 2.5) {
      if (await emit(admin, r, "reservation.reminder_2h_scheduled")) created2++;
    }
    if (
      (r.reconfirmation_status === "required" || r.reconfirmation_status === "requested") &&
      !r.reminder_sent_at &&
      hoursAhead >= 1 && hoursAhead <= 26
    ) {
      if (await emit(admin, r, "reservation.reconfirmation_requested")) createdReconfirm++;
    }
  }

  return ok({
    ok: true,
    scanned: reservations.length,
    created: {
      reminder_24h: created24,
      reminder_2h: created2,
      reconfirmation: createdReconfirm,
    },
    timestamp: now.toISOString(),
  });
});
