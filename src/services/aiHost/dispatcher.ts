// AI Host action dispatcher.
// - Single entry point voor alle AI-aangevraagde acties.
// - Valideert caller, validateert input, voert uit via bestaande services.
// - Logt elke poging in audit_log + integration_events (sandbox-style).
// - Geeft altijd een gestandaardiseerde AIActionResponse terug.
//
// Belangrijk:
// - We hergebruiken de reserveringsengine (manage_reservation, book_reservation,
//   availability) en doen GEEN parallelle "AI-only" beschikbaarheidslogica.
// - Externe AI mag bepaalde acties alleen voorbereiden; uitvoering blijft staff_user.

import { format } from "date-fns";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  AI_ACTION_CATALOG,
  AICallerType,
  AIActionResponse,
  AIReasonCode,
  callerNeedsHumanApproval,
  getActionByName,
  isCallerAllowed,
} from "./contracts";
import { manageReservation } from "@/services/reservations";
import { createWalkIn } from "@/services/walkIn";
import { createWaitlistEntry } from "@/services/waitlist";

/* --------------------------- response helpers --------------------------- */

function ok<T extends Record<string, unknown>>(
  action: string,
  message_for_guest: string,
  internal_message: string,
  data: T,
): AIActionResponse<T> {
  return {
    success: true,
    action,
    status: "ok",
    message_for_guest,
    internal_message,
    data,
    requires_human: false,
    reason_code: "ok",
  };
}

function err(
  action: string,
  message_for_guest: string,
  internal_message: string,
  reason_code: AIReasonCode,
): AIActionResponse {
  return {
    success: false,
    action,
    status: "error",
    message_for_guest,
    internal_message,
    data: {},
    requires_human: false,
    reason_code,
  };
}

function pendingHuman(
  action: string,
  message_for_guest: string,
  internal_message: string,
  data: Record<string, unknown> = {},
): AIActionResponse {
  return {
    success: true,
    action,
    status: "pending_human",
    message_for_guest,
    internal_message,
    data,
    requires_human: true,
    reason_code: "needs_human_approval",
  };
}

/* ------------------------------- logging ------------------------------- */

async function logActionAttempt(
  restaurantId: string,
  caller: AICallerType,
  actionName: string,
  payload: unknown,
  response: AIActionResponse,
) {
  try {
    await supabase.from("audit_log").insert([
      {
        restaurant_id: restaurantId,
        action: `ai_action.${actionName}`,
        entity: "ai_host",
        entity_id: null,
        actor_label: caller,
        before_data: payload as never,
        after_data: response as never,
      },
    ]);
  } catch {
    /* non-fatal */
  }
  try {
    await supabase.from("integration_events").insert([
      {
        restaurant_id: restaurantId,
        event_type: `ai_host.${actionName}`,
        target: "clickwise",
        status: "pending",
        payload: {
          caller_type: caller,
          request: payload,
          response,
        } as never,
      },
    ]);
  } catch {
    /* non-fatal */
  }
}

/* ------------------------------ dispatcher ----------------------------- */

export type DispatchInput = {
  restaurantId: string;
  caller: AICallerType;
  action: string;
  payload: Record<string, unknown>;
};

export async function dispatchAIAction(input: DispatchInput): Promise<AIActionResponse> {
  const contract = getActionByName(input.action);
  if (!contract) {
    const r = err(
      input.action,
      "Sorry, dat kan ik nu niet voor je doen. Ik schakel een collega in.",
      `Unknown action: ${input.action}`,
      "not_implemented",
    );
    await logActionAttempt(input.restaurantId, input.caller, input.action, input.payload, r);
    return r;
  }

  if (!isCallerAllowed(contract, input.caller)) {
    const r: AIActionResponse = {
      success: false,
      action: input.action,
      status: "error",
      message_for_guest: "Daarvoor verbind ik je even door met een collega.",
      internal_message: `Caller ${input.caller} not allowed for ${input.action}`,
      data: {},
      requires_human: true,
      reason_code: "permission_denied",
    };
    await logActionAttempt(input.restaurantId, input.caller, input.action, input.payload, r);
    return r;
  }

  // Acties die externe AI alleen mag voorbereiden — niet uitvoeren
  if (callerNeedsHumanApproval(contract, input.caller)) {
    const r = pendingHuman(
      input.action,
      "Een collega bevestigt dit zo voor je.",
      `Action ${input.action} requires human approval for caller ${input.caller}`,
      input.payload,
    );
    await logActionAttempt(input.restaurantId, input.caller, input.action, input.payload, r);
    return r;
  }

  let response: AIActionResponse;
  try {
    response = await runAction(contract.name, input);
  } catch (e) {
    response = err(
      input.action,
      "Er ging iets mis. Een collega kijkt er naar.",
      `Engine error: ${e instanceof Error ? e.message : String(e)}`,
      "engine_error",
    );
  }
  await logActionAttempt(input.restaurantId, input.caller, input.action, input.payload, response);
  return response;
}

/* ------------------------- per-action runners -------------------------- */

async function runAction(name: string, input: DispatchInput): Promise<AIActionResponse> {
  switch (name) {
    case "check_availability":
      return runCheckAvailability(input);
    case "create_reservation":
      return runCreateReservation(input);
    case "update_reservation":
      return runUpdateReservation(input);
    case "cancel_reservation":
      return runCancelReservation(input);
    case "find_reservation_by_phone":
      return runFindReservationByPhone(input);
    case "get_reservation_details":
      return runGetReservationDetails(input);
    case "reconfirm_reservation":
      return runReconfirmReservation(input);
    case "create_waitlist_entry":
      return runCreateWaitlistEntry(input);
    case "find_waitlist_matches":
      return runFindWaitlistMatches(input);
    case "create_walk_in":
      return runCreateWalkIn(input);
    case "find_or_create_guest":
      return runFindOrCreateGuest(input);
    case "add_guest_note":
      return runAddGuestNote(input);
    case "get_pre_order_options":
      return runGetPreOrderOptions(input);
    case "add_pre_order_to_reservation":
      return runAddPreOrderToReservation(input);
    case "get_opening_hours":
      return runGetOpeningHours(input);
    case "get_location_info":
      return runGetLocationInfo(input);
    case "get_booking_rules":
      return runGetBookingRules(input);
    case "get_large_group_rules":
      return runGetLargeGroupRules(input);
    case "get_cancellation_policy":
      return runGetCancellationPolicy(input);
    case "escalate_to_staff":
    case "request_human_callback":
      return runEscalation(input, name);
    default:
      return err(name, "Sorry, dat kan ik nu niet voor je doen.", `runner missing for ${name}`, "not_implemented");
  }
}

/* ------------------------------ schemas ------------------------------- */

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum is verplicht (YYYY-MM-DD).");
const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Tijd is verplicht (HH:mm).");

type Validated<T> = { ok: true; data: T; res?: undefined } | { ok: false; data?: undefined; res: AIActionResponse };

function v<T>(schema: z.ZodSchema<T>, payload: unknown, action: string): Validated<T> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      res: err(
        action,
        "Sorry, er ontbreekt nog wat informatie. Mag ik dat even nakijken met je?",
        `Validation: ${parsed.error.issues.map((i) => `${i.path.join(".")}=${i.message}`).join("; ")}`,
        "validation_failed",
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/* --------------------------- runners (impl) --------------------------- */

async function runCheckAvailability(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({
    date: dateSchema,
    party_size: z.number().int().min(1).max(50),
    preferred_time: timeSchema,
  });
  const r = v(schema, input.payload, "check_availability");
  if (!r.ok) return r.res;
  const { date, party_size, preferred_time } = r.data;

  const { data, error } = await supabase.functions.invoke("availability", {
    body: { restaurant_id: input.restaurantId, date, party_size },
  });
  if (error) {
    return err(
      "check_availability",
      "Ik kan de beschikbaarheid nu even niet ophalen. Een collega helpt je verder.",
      error.message,
      "engine_error",
    );
  }

  const slots: Array<{ time: string; available: boolean; available_table_count: number }> =
    (data?.slots as never) ?? [];
  const available = slots.filter((s) => s.available);
  if (data?.large_group) {
    return ok(
      "check_availability",
      "Voor zo'n grote groep nemen we even contact op om de details door te nemen.",
      "Large group detected — falling back to large_group flow.",
      { large_group: true, message: data?.message, exact: null, alternatives: [] },
    );
  }
  if (data?.closed) {
    return err(
      "check_availability",
      "We zijn die dag gesloten.",
      data?.message ?? "closed",
      "outside_opening_hours",
    );
  }

  const exact = available.find((s) => s.time.startsWith(preferred_time)) ?? null;
  const [ph, pm] = preferred_time.split(":").map(Number);
  const prefMin = ph * 60 + pm;
  const alternatives = [...available]
    .map((s) => {
      const [h, m] = s.time.split(":").map(Number);
      return { slot: s, dist: Math.abs(h * 60 + m - prefMin) };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((x) => x.slot);

  if (available.length === 0) {
    return ok(
      "check_availability",
      "Op dat moment is het helaas vol. Wil je dat ik je op de wachtlijst zet?",
      "No availability returned by engine.",
      { available: false, exact: null, alternatives: [], slots },
    );
  }

  if (exact) {
    return ok(
      "check_availability",
      `${preferred_time} is beschikbaar voor ${party_size} ${party_size === 1 ? "persoon" : "personen"}.`,
      `Exact match for preferred_time ${preferred_time}.`,
      { available: true, preferred_time, exact, alternatives, slots },
    );
  }

  return ok(
    "check_availability",
    `${preferred_time} is helaas niet beschikbaar. Mogelijke alternatieven: ${alternatives.map((a) => a.time.slice(0, 5)).join(", ")}.`,
    `No exact match for ${preferred_time}; ${alternatives.length} alternatives offered.`,
    { available: true, preferred_time, exact: null, alternatives, slots },
  );
}

async function runCreateReservation(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({
    date: dateSchema,
    time: timeSchema,
    party_size: z.number().int().min(1).max(50),
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().email().max(255).optional(),
    special_requests: z.string().trim().max(500).optional(),
  });
  const r = v(schema, input.payload, "create_reservation");
  if (!r.ok) return r.res;
  const d = r.data;

  if (!d.phone && !d.email) {
    return err(
      "create_reservation",
      "Mag ik je telefoonnummer of e-mail om de reservering te bevestigen?",
      "phone or email required",
      "validation_failed",
    );
  }

  const { data, error } = await supabase.functions.invoke("book_reservation", {
    body: {
      restaurant_id: input.restaurantId,
      date: d.date,
      time: d.time.slice(0, 5),
      party_size: d.party_size,
      channel: input.caller === "staff_user" ? "phone" : "online",
      special_requests: d.special_requests,
      source_metadata: { caller_type: input.caller, source_channel: "ai_host" },
      guest: {
        first_name: d.first_name,
        last_name: d.last_name,
        phone: d.phone,
        email: d.email,
      },
    },
  });
  if (error) {
    const fnErr = (data as { error?: string; reason_code?: string }) || {};
    return err(
      "create_reservation",
      "Het lukt me nu niet om de reservering vast te leggen. Een collega helpt je verder.",
      fnErr.error || error.message,
      "engine_error",
    );
  }
  if ((data as { error?: string })?.error) {
    const e = data as { error: string; reason_code?: string };
    return err(
      "create_reservation",
      "Op dat moment is het toch vol. Wil je een ander tijdstip of de wachtlijst?",
      e.error,
      e.reason_code === "no_table" ? "no_table_available" : "engine_error",
    );
  }
  const reservation = (data as { reservation?: Record<string, unknown> })?.reservation || {};
  const code = (reservation as { confirmation_code?: string }).confirmation_code;
  const status = String((reservation as { status?: string }).status || "");
  if (status === "pending") {
    return pendingHuman(
      "create_reservation",
      "Genoteerd! We bevestigen het zo persoonlijk.",
      `Reservation created with status pending (code ${code}).`,
      { reservation },
    );
  }
  return ok(
    "create_reservation",
    code ? `Genoteerd! Bevestiging: ${code}.` : "Je reservering staat genoteerd.",
    `Reservation confirmed (${code ?? "no code"}).`,
    { reservation },
  );
}

async function runUpdateReservation(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({
    reservation_id: z.string().uuid(),
    new_date: dateSchema.optional(),
    new_time: timeSchema.optional(),
    new_party_size: z.number().int().min(1).max(50).optional(),
    special_requests: z.string().trim().max(500).optional(),
  });
  const r = v(schema, input.payload, "update_reservation");
  if (!r.ok) return r.res;
  const d = r.data;
  const res = await manageReservation({
    action: "update",
    reservation_id: d.reservation_id,
    reservation_date: d.new_date,
    start_time_local: d.new_time?.slice(0, 5),
    party_size: d.new_party_size,
    special_requests: d.special_requests,
  });
  if (!res.ok) {
    return err(
      "update_reservation",
      "De wijziging lukt niet — een collega kijkt er even naar.",
      res.error ?? "manage failed",
      res.reason_code === "no_table_available" ? "no_table_available" : "engine_error",
    );
  }
  return ok("update_reservation", "We hebben je reservering aangepast.", "Reservation updated", { reservation: res.reservation });
}

async function runCancelReservation(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({
    reservation_id: z.string().uuid(),
    reason: z.string().trim().max(500).optional(),
  });
  const r = v(schema, input.payload, "cancel_reservation");
  if (!r.ok) return r.res;
  const res = await manageReservation({
    action: "cancel",
    reservation_id: r.data.reservation_id,
    cancellation_reason: r.data.reason,
  });
  if (!res.ok) {
    return err("cancel_reservation", "Annuleren lukt niet. Een collega helpt je verder.", res.error ?? "cancel failed", "engine_error");
  }
  return ok("cancel_reservation", "Je reservering is geannuleerd. Bedankt voor het laten weten.", "Reservation cancelled", {});
}

async function runFindReservationByPhone(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({ phone: z.string().trim().min(4).max(40) });
  const r = v(schema, input.payload, "find_reservation_by_phone");
  if (!r.ok) return r.res;
  const phoneNorm = r.data.phone.replace(/[^\d+]/g, "");
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: guests } = await supabase
    .from("guests")
    .select("id")
    .eq("restaurant_id", input.restaurantId)
    .ilike("phone", `%${phoneNorm.slice(-7)}%`)
    .limit(5);

  const guestIds = (guests ?? []).map((g) => g.id);
  if (guestIds.length === 0) {
    return err(
      "find_reservation_by_phone",
      "Ik kan geen reservering op dit nummer vinden. Mag ik je naam of e-mail?",
      "no guest matched phone",
      "not_found",
    );
  }

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, reservation_date, start_time, party_size, status, confirmation_code")
    .eq("restaurant_id", input.restaurantId)
    .in("guest_id", guestIds)
    .gte("reservation_date", today)
    .order("reservation_date", { ascending: true })
    .limit(5);

  if (!reservations || reservations.length === 0) {
    return err(
      "find_reservation_by_phone",
      "Ik zie geen aankomende reservering op dit nummer.",
      "no upcoming reservations",
      "not_found",
    );
  }
  return ok(
    "find_reservation_by_phone",
    "Ik zie je reservering staan.",
    `Found ${reservations.length} reservation(s)`,
    { reservations },
  );
}

async function runGetReservationDetails(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({ reservation_id: z.string().uuid() });
  const r = v(schema, input.payload, "get_reservation_details");
  if (!r.ok) return r.res;
  const { data, error } = await supabase
    .from("reservations")
    .select("id, reservation_date, start_time, end_time, party_size, status, confirmation_code, special_requests")
    .eq("id", r.data.reservation_id)
    .eq("restaurant_id", input.restaurantId)
    .maybeSingle();
  if (error || !data) {
    return err("get_reservation_details", "Ik kan deze reservering niet vinden.", error?.message ?? "not found", "not_found");
  }
  return ok("get_reservation_details", "Ik heb de details voor je.", "Reservation details fetched", { reservation: data });
}

async function runReconfirmReservation(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({ reservation_id: z.string().uuid() });
  const r = v(schema, input.payload, "reconfirm_reservation");
  if (!r.ok) return r.res;
  const res = await manageReservation({
    action: "mark_reconfirmed",
    reservation_id: r.data.reservation_id,
  });
  if (!res.ok) {
    return err("reconfirm_reservation", "Bevestigen lukt niet. Een collega kijkt ernaar.", res.error ?? "reconfirm failed", "engine_error");
  }
  return ok("reconfirm_reservation", "Bedankt voor het bevestigen, tot snel!", "Reconfirmed", {});
}

async function runCreateWaitlistEntry(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({
    date: dateSchema,
    time_from: timeSchema.optional(),
    time_to: timeSchema.optional(),
    party_size: z.number().int().min(1).max(50),
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().email().optional(),
    notes: z.string().trim().max(500).optional(),
  });
  const r = v(schema, input.payload, "create_waitlist_entry");
  if (!r.ok) return r.res;
  const d = r.data;
  const res = await createWaitlistEntry({
    restaurantId: input.restaurantId,
    firstName: d.first_name,
    lastName: d.last_name,
    phone: d.phone,
    email: d.email,
    desiredDate: d.date,
    desiredTimeFrom: d.time_from,
    desiredTimeTo: d.time_to,
    partySize: d.party_size,
    notes: d.notes,
    channel: "online",
  });
  if (!res.ok) {
    return err("create_waitlist_entry", "Op de wachtlijst zetten lukt niet. Een collega helpt je verder.", res.error ?? "waitlist failed", "engine_error");
  }
  return ok(
    "create_waitlist_entry",
    "Je staat op de wachtlijst. We laten het direct weten als er plek vrijkomt.",
    "Waitlist entry created",
    { entry: res.entry },
  );
}

async function runFindWaitlistMatches(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({
    date: dateSchema,
    time: timeSchema,
    party_size: z.number().int().min(1).max(50),
  });
  const r = v(schema, input.payload, "find_waitlist_matches");
  if (!r.ok) return r.res;
  const d = r.data;
  const { data: entries } = await supabase
    .from("waitlist_entries")
    .select("id, first_name, last_name, phone, party_size, desired_time_from, desired_time_to, flexible_minutes")
    .eq("restaurant_id", input.restaurantId)
    .eq("desired_date", d.date)
    .eq("status", "waiting")
    .lte("party_size", d.party_size + 1)
    .gte("party_size", Math.max(1, d.party_size - 1))
    .limit(10);
  return ok(
    "find_waitlist_matches",
    "Mogelijke matches gevonden.",
    `Matches: ${(entries ?? []).length}`,
    { matches: entries ?? [] },
  );
}

async function runCreateWalkIn(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({
    party_size: z.number().int().min(1).max(50),
    table_id: z.string().uuid().optional(),
    first_name: z.string().trim().max(100).optional(),
  });
  const r = v(schema, input.payload, "create_walk_in");
  if (!r.ok) return r.res;
  const res = await createWalkIn({
    restaurantId: input.restaurantId,
    partySize: r.data.party_size,
    tableId: r.data.table_id,
    guest: r.data.first_name ? { firstName: r.data.first_name } : undefined,
  });
  if (!res.ok) {
    return err("create_walk_in", "Walk-in plaatsen lukt niet.", res.error ?? "walkin failed", "engine_error");
  }
  return ok("create_walk_in", "Walk-in geregistreerd.", "Walk-in seated", { reservation: res.reservation });
}

async function runFindOrCreateGuest(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().email().optional(),
  });
  const r = v(schema, input.payload, "find_or_create_guest");
  if (!r.ok) return r.res;
  const d = r.data;
  if (!d.phone && !d.email) {
    return err(
      "find_or_create_guest",
      "Mag ik je telefoonnummer of e-mail noteren?",
      "phone or email required",
      "validation_failed",
    );
  }
  // try match
  let found: { id: string } | null = null;
  if (d.phone) {
    const { data } = await supabase
      .from("guests")
      .select("id")
      .eq("restaurant_id", input.restaurantId)
      .ilike("phone", `%${d.phone.replace(/[^\d+]/g, "").slice(-7)}%`)
      .maybeSingle();
    found = data ?? null;
  }
  if (!found && d.email) {
    const { data } = await supabase
      .from("guests")
      .select("id")
      .eq("restaurant_id", input.restaurantId)
      .ilike("email", d.email)
      .maybeSingle();
    found = data ?? null;
  }
  if (found) {
    return ok("find_or_create_guest", "Ik herken je profiel.", "Existing guest matched", { guest_id: found.id, created: false });
  }
  const { data: created, error } = await supabase
    .from("guests")
    .insert([
      {
        restaurant_id: input.restaurantId,
        first_name: d.first_name,
        last_name: d.last_name ?? null,
        full_name: [d.first_name, d.last_name].filter(Boolean).join(" "),
        phone: d.phone ?? null,
        email: d.email ?? null,
        source_channel: "ai_host",
      },
    ])
    .select("id")
    .maybeSingle();
  if (error || !created) {
    return err("find_or_create_guest", "Een collega rondt het profiel zo af.", error?.message ?? "insert failed", "engine_error");
  }
  return ok("find_or_create_guest", "Profiel aangemaakt.", "Guest created", { guest_id: created.id, created: true });
}

async function runAddGuestNote(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({
    guest_id: z.string().uuid(),
    note: z.string().trim().min(1).max(500),
    note_type: z.string().optional(),
  });
  const r = v(schema, input.payload, "add_guest_note");
  if (!r.ok) return r.res;
  const { error } = await supabase.from("guest_notes").insert([
    {
      restaurant_id: input.restaurantId,
      guest_id: r.data.guest_id,
      note: r.data.note,
      note_type: r.data.note_type ?? "general",
    },
  ]);
  if (error) {
    return err("add_guest_note", "Notitie kan ik niet opslaan.", error.message, "engine_error");
  }
  return ok("add_guest_note", "Notitie toegevoegd.", "Note saved", {});
}

async function runGetPreOrderOptions(input: DispatchInput): Promise<AIActionResponse> {
  const { data, error } = await supabase
    .from("pre_order_items")
    .select("id, name, description, category, price_cents")
    .eq("restaurant_id", input.restaurantId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .limit(50);
  if (error) {
    return err("get_pre_order_options", "Ik kan de opties nu niet ophalen.", error.message, "engine_error");
  }
  return ok("get_pre_order_options", "Hier zijn een paar opties.", `Items: ${(data ?? []).length}`, { items: data ?? [] });
}

async function runAddPreOrderToReservation(input: DispatchInput): Promise<AIActionResponse> {
  const schema = z.object({
    reservation_id: z.string().uuid(),
    pre_order_item_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(50).optional(),
    note: z.string().trim().max(300).optional(),
  });
  const r = v(schema, input.payload, "add_pre_order_to_reservation");
  if (!r.ok) return r.res;
  const { data: item } = await supabase
    .from("pre_order_items")
    .select("name, price_cents")
    .eq("id", r.data.pre_order_item_id)
    .maybeSingle();
  if (!item) return err("add_pre_order_to_reservation", "Dat item ken ik niet.", "item not found", "not_found");
  const { error } = await supabase.from("pre_orders").insert([
    {
      reservation_id: r.data.reservation_id,
      pre_order_item_id: r.data.pre_order_item_id,
      item_name: item.name,
      unit_price_cents: item.price_cents ?? 0,
      quantity: r.data.quantity ?? 1,
      note: r.data.note ?? null,
      status: "requested",
    },
  ]);
  if (error) return err("add_pre_order_to_reservation", "Toevoegen lukt niet.", error.message, "engine_error");
  return ok("add_pre_order_to_reservation", "Pre-order genoteerd.", "Pre-order added", {});
}

async function runGetOpeningHours(input: DispatchInput): Promise<AIActionResponse> {
  const { data: hours } = await supabase
    .from("opening_hours")
    .select("weekday, open_time, close_time, is_closed")
    .eq("restaurant_id", input.restaurantId)
    .order("weekday");
  return ok("get_opening_hours", "Hier zijn onze openingstijden.", "Opening hours fetched", { hours: hours ?? [] });
}

async function runGetLocationInfo(input: DispatchInput): Promise<AIActionResponse> {
  const { data } = await supabase
    .from("restaurants")
    .select("name, address_line1, postal_code, city, country, phone, email, website")
    .eq("id", input.restaurantId)
    .maybeSingle();
  if (!data) return err("get_location_info", "Ik kan onze gegevens niet ophalen.", "no restaurant", "not_found");
  return ok("get_location_info", `Je vindt ons aan ${data.address_line1 ?? ""}, ${data.city ?? ""}.`, "Location fetched", { location: data });
}

async function runGetBookingRules(input: DispatchInput): Promise<AIActionResponse> {
  const { data } = await supabase
    .from("restaurants")
    .select("max_party_size_online, large_group_threshold, booking_lead_time_minutes, booking_horizon_days, default_reservation_minutes")
    .eq("id", input.restaurantId)
    .maybeSingle();
  if (!data) return err("get_booking_rules", "Ik kan onze regels niet ophalen.", "no restaurant", "not_found");
  return ok("get_booking_rules", "Onze boekingsregels in het kort.", "Booking rules fetched", { rules: data });
}

async function runGetLargeGroupRules(input: DispatchInput): Promise<AIActionResponse> {
  const { data } = await supabase
    .from("restaurants")
    .select("large_group_threshold, large_group_auto_book_max, large_group_manual_approval_from, large_group_deposit_recommended_from, large_group_minutes, large_group_extra_minutes, large_group_confirmation_text, large_group_cancellation_terms")
    .eq("id", input.restaurantId)
    .maybeSingle();
  if (!data) return err("get_large_group_rules", "Ik kan dit niet ophalen.", "no restaurant", "not_found");
  return ok("get_large_group_rules", "Voor grote groepen geldt het volgende.", "Large group rules fetched", { rules: data });
}

async function runGetCancellationPolicy(input: DispatchInput): Promise<AIActionResponse> {
  const { data: r } = await supabase
    .from("restaurants")
    .select("noshow_cancellation_cutoff_minutes, deposit_default_amount_cents, deposit_voucher_credit_possible, deposit_guest_message")
    .eq("id", input.restaurantId)
    .maybeSingle();
  const { data: policies } = await supabase
    .from("deposit_policies")
    .select("name, description, min_party_size, amount_cents_per_guest, refundable_until_hours_before, is_active")
    .eq("restaurant_id", input.restaurantId)
    .eq("is_active", true);
  return ok("get_cancellation_policy", "Ons annuleringsbeleid.", "Policy fetched", { restaurant: r, policies: policies ?? [] });
}

async function runEscalation(input: DispatchInput, name: string): Promise<AIActionResponse> {
  const schema = z.object({
    reason: z.string().trim().max(500).optional(),
    phone: z.string().trim().max(40).optional(),
    summary: z.string().trim().max(500).optional(),
  });
  const r = v(schema, input.payload, name);
  if (!r.ok) return r.res;
  // Logging happens in dispatcher anyway; we only return a friendly status.
  return pendingHuman(
    name,
    "Een collega neemt het zo van me over.",
    `Escalation requested: ${r.data.reason ?? "no reason"}`,
    { reason: r.data.reason, phone: r.data.phone, summary: r.data.summary },
  );
}
