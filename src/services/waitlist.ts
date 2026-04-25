// Waitlist service — single point of truth for waitlist operations.
//
// Why a service?
// - Centralizes waitlist business rules (status transitions, match logic)
// - Conversion to reservation always re-checks availability via book_reservation
// - Logs integration_events + audit_log so ClickWise/AI can pick up later
// - Keeps UI components free of scattered supabase.from() calls
//
// Out of scope on purpose:
// - Real WhatsApp/SMS/email sending (only event preparation)
// - Real ClickWise API call
// - Automatic conversion without staff confirmation
import { z } from "zod";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type WaitlistRow = Database["public"]["Tables"]["waitlist_entries"]["Row"];
export type WaitlistStatus = Database["public"]["Enums"]["waitlist_status"];
export type WaitlistChannel = Database["public"]["Enums"]["reservation_channel"];

export type WaitlistEntry = WaitlistRow;

/* ---------------------------------- Create --------------------------------- */

export const waitlistCreateSchema = z.object({
  restaurantId: z.string().uuid(),
  firstName: z.string().trim().min(1, "Naam is verplicht.").max(100),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.string().trim().email("Ongeldig e-mailadres."), z.literal("")]).optional(),
  desiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum is verplicht."),
  desiredTimeFrom: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  desiredTimeTo: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  partySize: z.number().int().min(1, "Vul het aantal personen in.").max(50),
  zonePreference: z.string().uuid().optional().nullable(),
  flexibleMinutes: z.number().int().min(0).max(240).optional(),
  notes: z.string().trim().max(500).optional(),
  channel: z.string().optional(),
  guestId: z.string().uuid().optional().nullable(),
});

export type WaitlistCreateInput = z.infer<typeof waitlistCreateSchema>;

function normalizeTime(t?: string): string | undefined {
  if (!t) return undefined;
  return t.length === 5 ? `${t}:00` : t;
}

export async function createWaitlistEntry(raw: WaitlistCreateInput): Promise<{ ok: boolean; error?: string; entry?: WaitlistRow }> {
  const parsed = waitlistCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }
  const v = parsed.data;
  if (v.desiredTimeFrom && v.desiredTimeTo && v.desiredTimeTo <= v.desiredTimeFrom) {
    return { ok: false, error: "Eindtijd moet na de starttijd liggen." };
  }
  const now = new Date();
  const fromTime = normalizeTime(v.desiredTimeFrom) ?? format(now, "HH:mm:ss");
  const toTime =
    normalizeTime(v.desiredTimeTo) ??
    format(new Date(now.getTime() + 90 * 60_000), "HH:mm:ss");

  const insert: Database["public"]["Tables"]["waitlist_entries"]["Insert"] = {
    restaurant_id: v.restaurantId,
    first_name: v.firstName,
    last_name: v.lastName || null,
    phone: v.phone || null,
    email: v.email || null,
    desired_date: v.desiredDate,
    desired_time_from: fromTime,
    desired_time_to: toTime,
    party_size: v.partySize,
    zone_preference: v.zonePreference || null,
    flexible_minutes: v.flexibleMinutes ?? 30,
    notes: v.notes || null,
    channel: (v.channel as WaitlistChannel) || "online",
    guest_id: v.guestId || null,
    language: "nl",
  };

  const { data, error } = await supabase
    .from("waitlist_entries")
    .insert(insert)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message || "Wachtlijstitem opslaan mislukt." };
  }
  await logIntegrationEvent(v.restaurantId, "waitlist.created", {
    waitlist_entry_id: data.id,
    party_size: v.partySize,
    desired_date: v.desiredDate,
  });
  await logAudit(v.restaurantId, "waitlist.created", "waitlist_entry", data.id, null, data);
  return { ok: true, entry: data };
}

/* ---------------------------------- Update --------------------------------- */

export async function updateWaitlistEntry(
  id: string,
  fields: Partial<{
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    desiredDate: string;
    desiredTimeFrom: string;
    desiredTimeTo: string;
    partySize: number;
    zonePreference: string | null;
    flexibleMinutes: number;
    notes: string | null;
    status: WaitlistStatus;
  }>,
): Promise<{ ok: boolean; error?: string; entry?: WaitlistRow }> {
  const update: Database["public"]["Tables"]["waitlist_entries"]["Update"] = {};
  if (fields.firstName !== undefined) update.first_name = fields.firstName;
  if (fields.lastName !== undefined) update.last_name = fields.lastName;
  if (fields.phone !== undefined) update.phone = fields.phone;
  if (fields.email !== undefined) update.email = fields.email;
  if (fields.desiredDate !== undefined) update.desired_date = fields.desiredDate;
  if (fields.desiredTimeFrom !== undefined) update.desired_time_from = normalizeTime(fields.desiredTimeFrom)!;
  if (fields.desiredTimeTo !== undefined) update.desired_time_to = normalizeTime(fields.desiredTimeTo)!;
  if (fields.partySize !== undefined) update.party_size = fields.partySize;
  if (fields.zonePreference !== undefined) update.zone_preference = fields.zonePreference;
  if (fields.flexibleMinutes !== undefined) update.flexible_minutes = fields.flexibleMinutes;
  if (fields.notes !== undefined) update.notes = fields.notes;
  if (fields.status !== undefined) update.status = fields.status;

  const { data, error } = await supabase
    .from("waitlist_entries")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message || "Wijziging niet opgeslagen." };
  }
  await logIntegrationEvent(data.restaurant_id, "waitlist.updated", { waitlist_entry_id: id });
  await logAudit(data.restaurant_id, "waitlist.updated", "waitlist_entry", id, null, update);
  return { ok: true, entry: data };
}

/* --------------------------------- Cancel --------------------------------- */

export async function cancelWaitlistEntry(id: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("waitlist_entries")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("restaurant_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "Annuleren mislukt." };
  await logIntegrationEvent(data.restaurant_id, "waitlist.cancelled", { waitlist_entry_id: id, reason });
  await logAudit(data.restaurant_id, "waitlist.cancelled", "waitlist_entry", id, null, { reason });
  return { ok: true };
}

export async function expireWaitlistEntry(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("waitlist_entries")
    .update({ status: "expired" })
    .eq("id", id)
    .select("restaurant_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "Markeren mislukt." };
  await logIntegrationEvent(data.restaurant_id, "waitlist.expired", { waitlist_entry_id: id });
  await logAudit(data.restaurant_id, "waitlist.expired", "waitlist_entry", id, null, null);
  return { ok: true };
}

/* --------------------------------- Matches -------------------------------- */

export type MatchScore = "high" | "medium" | "low";
export type WaitlistMatch = {
  entry: WaitlistRow;
  score: MatchScore;
  reason: string;
};

/**
 * Find candidate waitlist entries that could fill a freed reservation slot.
 * Used after cancellation/no-show. Pure DB query + scoring; no side-effects.
 */
export async function findWaitlistMatches(input: {
  restaurantId: string;
  date: string; // yyyy-MM-dd
  startTime: string; // HH:mm or HH:mm:ss
  partySize: number;
  zoneId?: string | null;
}): Promise<WaitlistMatch[]> {
  const start = normalizeTime(input.startTime)!;
  const { data, error } = await supabase
    .from("waitlist_entries")
    .select("*")
    .eq("restaurant_id", input.restaurantId)
    .eq("desired_date", input.date)
    .in("status", ["waiting", "matched", "notified"])
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  // 30-min window before/after freed slot
  const startMin = toMinutes(start);
  return data
    .map<WaitlistMatch | null>((e) => {
      if (e.party_size > input.partySize + 0) {
        // can only fit equal or smaller groups (capacity safety)
        if (e.party_size > input.partySize) return null;
      }
      const fromMin = toMinutes(e.desired_time_from);
      const toMin = toMinutes(e.desired_time_to);
      const flex = e.flexible_minutes ?? 0;
      const inWindow = startMin >= fromMin - flex && startMin <= toMin + flex;

      const sizeFit = e.party_size === input.partySize;
      const zoneMatch = !e.zone_preference || (input.zoneId && e.zone_preference === input.zoneId);

      if (!inWindow && Math.abs(startMin - fromMin) > 60) return null;

      let score: MatchScore = "low";
      const reasons: string[] = [];
      if (inWindow && sizeFit && zoneMatch) {
        score = "high";
        reasons.push("Tijd, groepsgrootte en zone passen.");
      } else if (inWindow && (sizeFit || zoneMatch)) {
        score = "medium";
        reasons.push("Tijd past en deels passende voorkeuren.");
      } else {
        reasons.push("Datum en groep passen, tijd of zone wijkt af.");
      }
      return { entry: e, score, reason: reasons.join(" ") };
    })
    .filter((x): x is WaitlistMatch => x !== null)
    .sort((a, b) => scoreRank(b.score) - scoreRank(a.score));
}

/**
 * Suggest available freed slots for a single waitlist entry.
 * MVP: returns the entry's preferred window so the operator can attempt to
 * convert via book_reservation (which performs the real availability check).
 */
export type SlotSuggestion = {
  date: string;
  time: string;
  reason: string;
};

export function suggestSlotsForEntry(entry: WaitlistRow): SlotSuggestion[] {
  // Build a small set of candidate times around desired window, in 15-min steps.
  const fromMin = toMinutes(entry.desired_time_from);
  const toMin = toMinutes(entry.desired_time_to);
  const flex = entry.flexible_minutes ?? 0;
  const startMin = Math.max(0, fromMin - flex);
  const endMin = Math.min(24 * 60 - 15, toMin + flex);
  const slots: SlotSuggestion[] = [];
  for (let m = startMin; m <= endMin; m += 15) {
    slots.push({
      date: entry.desired_date,
      time: minutesToHHmm(m),
      reason: m >= fromMin && m <= toMin ? "Binnen voorkeur" : "Binnen flexibiliteit",
    });
    if (slots.length >= 6) break;
  }
  return slots;
}

/* ----------------------------- Notification prep ---------------------------- */

/**
 * Prepare a ClickWise-ready notification event. Does NOT send anything.
 * Sets status to `notified` so operators see preparation state.
 */
export async function createWaitlistNotificationEvent(
  entryId: string,
  template: { time: string; party_size: number; date: string },
): Promise<{ ok: boolean; error?: string }> {
  const { data: entry, error: fetchErr } = await supabase
    .from("waitlist_entries")
    .select("*")
    .eq("id", entryId)
    .maybeSingle();
  if (fetchErr || !entry) return { ok: false, error: "Wachtlijstitem niet gevonden." };
  if (entry.status === "converted" || entry.status === "cancelled" || entry.status === "expired") {
    return { ok: false, error: "Dit wachtlijstitem is niet meer actief." };
  }

  const { error: updErr } = await supabase
    .from("waitlist_entries")
    .update({ status: "notified", notified_at: new Date().toISOString() })
    .eq("id", entryId);
  if (updErr) return { ok: false, error: updErr.message };

  await logIntegrationEvent(entry.restaurant_id, "waitlist.notification_requested", {
    waitlist_entry_id: entryId,
    template,
    contact: { phone: entry.phone, email: entry.email, first_name: entry.first_name },
  });
  await logAudit(entry.restaurant_id, "waitlist.notification_requested", "waitlist_entry", entryId, null, template);
  return { ok: true };
}

/* ---------------------------- Convert to reservation ----------------------- */

export type ConvertInput = {
  entryId: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  partySize?: number;
};

export async function convertWaitlistToReservation(input: ConvertInput): Promise<{
  ok: boolean;
  error?: string;
  reservationId?: string;
}> {
  // 1. Load entry and guard against double conversion
  const { data: entry, error: fetchErr } = await supabase
    .from("waitlist_entries")
    .select("*")
    .eq("id", input.entryId)
    .maybeSingle();
  if (fetchErr || !entry) return { ok: false, error: "Wachtlijstitem niet gevonden." };
  if (entry.status === "converted") return { ok: false, error: "Dit item is al omgezet." };
  if (entry.status === "cancelled" || entry.status === "expired") {
    return { ok: false, error: "Deze wachtlijstkans is verlopen." };
  }

  const partySize = input.partySize ?? entry.party_size;

  // 2. Re-check availability + create reservation through the engine
  const { data: bookRes, error: bookErr } = await supabase.functions.invoke("book_reservation", {
    body: {
      restaurant_id: entry.restaurant_id,
      date: input.date,
      time: input.time,
      party_size: partySize,
      channel: "phone",
      source_label: "waitlist_conversion",
      guest: {
        first_name: entry.first_name,
        last_name: entry.last_name || undefined,
        email: entry.email || `waitlist-${entry.id}@tablewise.local`,
        phone: entry.phone || undefined,
        language: entry.language || "nl",
      },
      special_requests: entry.notes || undefined,
    },
  });

  const bookErrorBody = bookRes as { error?: string; reason_code?: string } | null;
  if (bookErr || bookErrorBody?.error) {
    const msg = bookErrorBody?.error || bookErr?.message || "Plek niet meer beschikbaar.";
    return {
      ok: false,
      error: /tafel|table|available|beschik/i.test(msg)
        ? "Deze plek is inmiddels niet meer beschikbaar. Kies een andere optie."
        : msg,
    };
  }

  const reservation = (bookRes as { reservation?: { id: string } }).reservation;
  if (!reservation?.id) return { ok: false, error: "Reservering kon niet worden aangemaakt." };

  // 3. Mark entry as converted
  const { error: convErr } = await supabase
    .from("waitlist_entries")
    .update({
      status: "converted",
      converted_reservation_id: reservation.id,
      matched_reservation_id: reservation.id,
      matched_at: new Date().toISOString(),
    })
    .eq("id", input.entryId)
    .eq("status", entry.status); // optimistic guard against race
  if (convErr) {
    // Reservation is created but flag failed — surface but don't roll back
    console.warn("convertWaitlistToReservation: failed to mark converted", convErr.message);
  }

  await logIntegrationEvent(entry.restaurant_id, "waitlist.converted", {
    waitlist_entry_id: input.entryId,
    reservation_id: reservation.id,
  });
  await logAudit(entry.restaurant_id, "waitlist.converted", "waitlist_entry", input.entryId, null, {
    reservation_id: reservation.id,
  });
  await logAudit(entry.restaurant_id, "reservation.converted_from_waitlist", "reservation", reservation.id, null, {
    waitlist_entry_id: input.entryId,
  });

  return { ok: true, reservationId: reservation.id };
}

/* -------------------------- Last-minute fill helper ------------------------ */

/**
 * Mark that a freed slot has waitlist match opportunities. Used by the
 * reservation cancel / no-show flow to surface a "wachtlijstkans" in UI.
 */
export async function announceLastMinuteOpportunity(input: {
  restaurantId: string;
  reservationId?: string;
  date: string;
  startTime: string;
  partySize: number;
  zoneId?: string | null;
  trigger: "cancellation" | "no_show";
}): Promise<void> {
  await logIntegrationEvent(input.restaurantId, "waitlist.last_minute_fill_opportunity", input);
  await logIntegrationEvent(
    input.restaurantId,
    input.trigger === "cancellation"
      ? "reservation.cancelled_waitlist_available"
      : "reservation.no_show_waitlist_available",
    input,
  );
}

/* --------------------------------- Helpers -------------------------------- */

function toMinutes(time: string): number {
  const [hh, mm] = time.split(":").map((x) => parseInt(x, 10));
  return hh * 60 + mm;
}
function minutesToHHmm(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${h}:${mm}`;
}
function scoreRank(s: MatchScore): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

async function logIntegrationEvent(
  restaurantId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("integration_events").insert({
      restaurant_id: restaurantId,
      event_type: eventType,
      payload: payload as never,
    } as never);
  } catch (e) {
    console.warn("integration_events insert failed", eventType, e);
  }
}

async function logAudit(
  restaurantId: string,
  action: string,
  entity: string,
  entityId: string,
  beforeData: unknown,
  afterData: unknown,
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      restaurant_id: restaurantId,
      action,
      entity,
      entity_id: entityId,
      before_data: beforeData as never,
      after_data: afterData as never,
    });
  } catch (e) {
    console.warn("audit_log insert failed", action, e);
  }
}
