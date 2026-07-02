// Walk-in service — single entry point for placing a spontaneous guest.
// Wraps the book_reservation edge function (channel="walk_in") and optional
// table linking. Validates input with Zod so neither UI nor edge fn ever
// receives malformed data.
//
// Why a service?
// - Consistent error mapping for the operator UI
// - Reusable from WalkInsPage, FloorMode, FloorPlan, AI Quick Seat
// - Centralised place to add audit/integration hooks later
import { z } from "zod";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export const walkInSchema = z.object({
  restaurantId: z.string().uuid(),
  partySize: z.number().int().min(1).max(50),
  /** Optional pre-selected table — server still re-checks conflicts. */
  tableId: z.string().uuid().optional(),
  /** Override walkin_default_minutes (45/60/75/90/120 typical). */
  durationMinutes: z.number().int().min(15).max(300).optional(),
  guest: z
    .object({
      firstName: z.string().trim().max(100).optional(),
      phone: z.string().trim().max(40).optional(),
      email: z.string().trim().email().max(255).optional(),
    })
    .optional(),
  notes: z.string().trim().max(500).optional(),
});

export type WalkInInput = z.infer<typeof walkInSchema>;

export type WalkInResult = {
  ok: boolean;
  error?: string;
  reason_code?: "no_table" | "pacing_full" | "validation" | "unknown";
  reservation?: {
    id: string;
    table_id: string | null;
    confirmation_code?: string;
    start_time?: string;
    end_time?: string;
  };
};

/**
 * Place a walk-in. Always:
 *  - sets channel="walk_in" → server uses walkin_default_minutes & skips pacing
 *  - status will be "seated" on success
 *  - prefills a synthetic email if no email supplied (book_reservation requires one)
 */
export async function createWalkIn(raw: WalkInInput): Promise<WalkInResult> {
  const parsed = walkInSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason_code: "validation",
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer voor walk-in.",
    };
  }
  const v = parsed.data;
  const now = new Date();
  const guestFirstName =
    v.guest?.firstName?.trim() && v.guest.firstName.trim().length > 0
      ? v.guest.firstName.trim()
      : "Walk-in";
  const trimmedEmail = v.guest?.email?.trim();
  const trimmedPhone = v.guest?.phone?.trim();
  const guestPhone = trimmedPhone && trimmedPhone.length > 0 ? trimmedPhone : undefined;
  // Anonieme walk-ins zijn toegestaan: zonder e-mail genereren we een synthetisch adres
  // zodat book_reservation (dat een e-mail verwacht) gewoon doorgaat.
  const guestEmail = trimmedEmail && trimmedEmail.length > 0
    ? trimmedEmail
    : `walkin-${Date.now()}@walkin.local`;

  const body: Record<string, unknown> = {
    restaurant_id: v.restaurantId,
    date: format(now, "yyyy-MM-dd"),
    time: format(now, "HH:mm"),
    party_size: v.partySize,
    channel: "walk_in",
    preselected_table_id: v.tableId ?? undefined,
    guest: {
      first_name: guestFirstName,
      email: guestEmail,
      phone: guestPhone,
      language: "nl",
    },
    special_requests: v.notes || undefined,
    source_metadata: {
      origin: "operator_walk_in",
      is_walk_in_guest: true,
      preselected_table_id: v.tableId ?? null,
      duration_override: v.durationMinutes ?? null,
    },
  };

  const { data, error } = await supabase.functions.invoke("book_reservation", {
    body,
  });

  if (error || (data as { error?: string })?.error) {
    const msg =
      (data as { error?: string })?.error ||
      error?.message ||
      "Walk-in plaatsen mislukt. Probeer het opnieuw.";
    const reason: WalkInResult["reason_code"] =
      /preselected_table_unavailable/i.test(msg) || /tafel/i.test(msg) || /no_table/i.test(msg) ? "no_table"
      : /pacing/i.test(msg) ? "pacing_full"
      : "unknown";
    return { ok: false, error: msg, reason_code: reason };
  }

  const reservation = (data as {
    reservation?: { id: string; table_id?: string | null; confirmation_code?: string; start_time?: string; end_time?: string };
  }).reservation;
  if (!reservation?.id) {
    return { ok: false, error: "Geen reservering teruggegeven.", reason_code: "unknown" };
  }

  // Engine honors preselected_table_id for walk-in — no extra linking needed.

  return {
    ok: true,
    reservation: {
      id: reservation.id,
      table_id: reservation.table_id ?? null,
      confirmation_code: reservation.confirmation_code,
      start_time: reservation.start_time,
      end_time: reservation.end_time,
    },
  };
}

/**
 * Add a guest to today's waitlist when no table is available.
 * Best-effort: returns ok=false with a friendly message on failure.
 */
export async function addToWaitlistNow(input: {
  restaurantId: string;
  partySize: number;
  firstName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (input.partySize < 1 || input.partySize > 50) {
    return { ok: false, error: "Aantal personen ongeldig." };
  }
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const fromTime = format(now, "HH:mm:ss");
  const to = new Date(now.getTime() + 90 * 60_000);
  const toTime = format(to, "HH:mm:ss");

  const { error } = await supabase.from("waitlist_entries").insert({
    restaurant_id: input.restaurantId,
    party_size: input.partySize,
    first_name: (input.firstName || "Walk-in").slice(0, 100),
    phone: input.phone?.slice(0, 40) ?? null,
    email: input.email?.slice(0, 255) ?? null,
    desired_date: today,
    desired_time_from: fromTime,
    desired_time_to: toTime,
    flexible_minutes: 30,
    notes: input.notes?.slice(0, 500) ?? null,
    channel: "walk_in",
    language: "nl",
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
