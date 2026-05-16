// manage_reservation — authenticated operator endpoint to update / cancel / change status.
// Re-runs availability + table conflict checks when date/time/party_size/table changes.
// Logs audit_log + integration_event. Status history is logged automatically by DB trigger.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  zonedDateTimeToUtcIso, addMinutesIso, intervalsOverlap, ACTIVE_STATUSES,
} from "../_shared/reservation-utils.ts";
import { evaluatePacing, durationFor, type PacingReservation } from "../_shared/pacing.ts";

type Action =
  | "update"
  | "cancel"
  | "change_status"
  | "mark_seated"
  | "mark_completed"
  | "mark_no_show"
  | "approve_large_group"
  | "decline_large_group"
  | "mark_reconfirmed"
  | "mark_reconfirmation_declined"
  | "request_reconfirmation"
  | "set_deposit_status";

type DepositStatus = "not_required" | "recommended" | "required" | "pending" | "paid" | "waived" | "refunded" | "failed";

type ManageRequest = {
  action: Action;
  reservation_id: string;
  // Update payload
  reservation_date?: string;       // YYYY-MM-DD
  start_time_local?: string;       // HH:MM
  party_size?: number;
  table_id?: string | null;        // assign / reassign / clear
  internal_notes?: string | null;
  special_requests?: string | null;
  // Status change
  new_status?: "pending" | "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
  cancellation_reason?: string;
  // Deposit
  deposit_status?: DepositStatus;
  deposit_amount_cents?: number;
  deposit_policy_notes?: string;
};

// Allowed status transitions (MVP-safe)
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  hold:      ["pending", "confirmed", "cancelled"],
  pending:   ["confirmed", "cancelled", "no_show"],
  confirmed: ["pending", "seated", "cancelled", "no_show"],
  seated:    ["confirmed", "completed", "cancelled"],
  // Eindstatussen mogen handmatig teruggezet worden voor correcties door staff
  completed: ["seated", "confirmed"],
  cancelled: ["pending", "confirmed"],
  no_show:   ["pending", "confirmed"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as ManageRequest;
    if (!body?.action || !body?.reservation_id) {
      return json({ error: "Missing action or reservation_id" }, 400);
    }

    // Use auth token to enforce RLS (operator must be member of restaurant)
    const authHeader = req.headers.get("Authorization") ?? "";
    const systemActor = req.headers.get("x-system-actor") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isSystemCall = systemActor.length > 0 && authHeader === `Bearer ${serviceRole}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    // Service-role client for writes that bypass RLS where needed (audit/integration logs).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRole,
    );

    let userId: string;
    if (isSystemCall) {
      userId = "00000000-0000-0000-0000-000000000000";
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return json({ error: "Niet ingelogd" }, 401);
      userId = user.id;
    }

    // Load current reservation (RLS ensures membership for operator calls; system uses admin)
    const reader = isSystemCall ? admin : supabase;
    const { data: current, error: cErr } = await reader
      .from("reservations")
      .select("*, reservation_tables(table_id)")
      .eq("id", body.reservation_id)
      .maybeSingle();
    if (cErr) return json({ error: cErr.message }, 500);
    if (!current) return json({ error: "Reservering niet gevonden" }, 404);


    // Load restaurant settings
    const { data: restaurant } = await admin
      .from("restaurants").select("*").eq("id", current.restaurant_id).maybeSingle();
    if (!restaurant) return json({ error: "Restaurant niet gevonden" }, 404);

    const tz: string = restaurant.timezone || "Europe/Amsterdam";

    // Branch by action
    switch (body.action) {
      case "cancel":
        return await doCancel(admin, current, body, userId);
      case "mark_no_show":
        return await doStatusChange(admin, current, "no_show", userId, body.cancellation_reason);
      case "mark_completed":
        return await doStatusChange(admin, current, "completed", userId);
      case "mark_seated":
        return await doStatusChange(admin, current, "seated", userId);
      case "change_status":
        if (!body.new_status) return json({ error: "new_status vereist" }, 400);
        return await doStatusChange(admin, current, body.new_status, userId, body.cancellation_reason);
      case "update":
        return await doUpdate(admin, current, restaurant, body, tz, userId);
      case "approve_large_group":
        return await doLargeGroupDecision(admin, current, "approve", userId, body.cancellation_reason);
      case "decline_large_group":
        return await doLargeGroupDecision(admin, current, "decline", userId, body.cancellation_reason);
      case "mark_reconfirmed":
        return await doReconfirmation(admin, current, "confirmed", userId);
      case "mark_reconfirmation_declined":
        return await doReconfirmation(admin, current, "declined", userId, body.cancellation_reason);
      case "request_reconfirmation":
        return await doReconfirmation(admin, current, "requested", userId);
      case "set_deposit_status":
        return await doSetDepositStatus(admin, current, body, userId);
      default:
        return json({ error: "Onbekende actie" }, 400);
    }
  } catch (e) {
    console.error("manage_reservation error", e);
    return json({ error: e instanceof Error ? e.message : "Onbekende fout" }, 500);
  }
});

async function doStatusChange(
  // deno-lint-ignore no-explicit-any
  admin: any,
  // deno-lint-ignore no-explicit-any
  current: any,
  newStatus: string,
  userId: string,
  reason?: string,
) {
  if (current.status === newStatus) {
    return json({ ok: true, reservation: current, unchanged: true });
  }
  const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return json({
      error: `Status '${current.status}' kan niet naar '${newStatus}' worden gewijzigd.`,
      reason_code: "invalid_transition",
    }, 409);
  }

  // deno-lint-ignore no-explicit-any
  const patch: Record<string, any> = { status: newStatus };
  if (newStatus === "cancelled") {
    patch.cancelled_at = new Date().toISOString();
    if (reason) patch.cancellation_reason = reason;
  }
  if (newStatus === "no_show") {
    patch.no_show_marked_at = new Date().toISOString();
  }

  const { data: updated, error } = await admin
    .from("reservations").update(patch).eq("id", current.id).select("*").single();
  if (error) return json({ error: error.message }, 500);

  // Bump guest.no_show_count once per reservation (only if not already marked).
  if (newStatus === "no_show" && !current.no_show_marked_at && current.guest_id) {
    try {
      const { data: g } = await admin
        .from("guests").select("no_show_count").eq("id", current.guest_id).maybeSingle();
      if (g) {
        await admin.from("guests")
          .update({ no_show_count: (g.no_show_count ?? 0) + 1 })
          .eq("id", current.guest_id);
      }
    } catch (e) { console.error("guest no_show_count bump failed", e); }
  }

  await logAudit(admin, current.restaurant_id, userId, `reservation.${newStatus}`, current.id, current, updated);
  await emitEvent(admin, current.restaurant_id, `reservation.${newStatus}`, {
    reservation_id: current.id,
    party_size: current.party_size,
    start_time: current.start_time,
    reason: reason ?? null,
  });

  // Wachtlijst auto-match: bij annulering zoek passende wachtende gasten en emit notificatie-events.
  if (newStatus === "cancelled") {
    try {
      await notifyWaitlistOnCancel(admin, current);
    } catch (e) {
      console.error("[manage_reservation] waitlist notify failed", e);
    }
  }

  return json({ ok: true, reservation: updated });
}

// Zoek wachtlijst-entries die binnen het tijdvenster van de geannuleerde reservering passen
// en emit `waitlist.notification_requested` events voor de eerste 3 matches.
// deno-lint-ignore no-explicit-any
async function notifyWaitlistOnCancel(admin: any, cancelled: any) {
  const startMs = new Date(cancelled.start_time).getTime();
  const date = cancelled.reservation_date;

  const { data: entries } = await admin
    .from("waitlist_entries")
    .select("id, party_size, desired_time_from, desired_time_to, flexible_minutes, status, notified_at")
    .eq("restaurant_id", cancelled.restaurant_id)
    .eq("desired_date", date)
    .eq("status", "waiting")
    .lte("party_size", cancelled.party_size)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!entries || entries.length === 0) return;

  const candidates: string[] = [];
  for (const e of entries) {
    if (e.notified_at) continue;
    const flex = (e.flexible_minutes ?? 30) * 60_000;
    const [fh, fm] = String(e.desired_time_from).split(":").map(Number);
    const [th, tm] = String(e.desired_time_to).split(":").map(Number);
    const fromMs = new Date(date).setHours(fh ?? 0, fm ?? 0, 0, 0);
    const toMs = new Date(date).setHours(th ?? 23, tm ?? 59, 0, 0);
    if (startMs >= fromMs - flex && startMs <= toMs + flex) {
      candidates.push(e.id);
      if (candidates.length >= 3) break;
    }
  }

  for (const id of candidates) {
    await admin.from("waitlist_entries")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", id);
    await emitEvent(admin, cancelled.restaurant_id, "waitlist.notification_requested", {
      waitlist_entry_id: id,
      trigger: "reservation.cancelled",
      cancelled_reservation_id: cancelled.id,
      start_time: cancelled.start_time,
      party_size: cancelled.party_size,
    });
  }
}

async function doCancel(
  // deno-lint-ignore no-explicit-any
  admin: any,
  // deno-lint-ignore no-explicit-any
  current: any,
  body: ManageRequest,
  userId: string,
) {
  return doStatusChange(admin, current, "cancelled", userId, body.cancellation_reason);
}

async function doUpdate(
  // deno-lint-ignore no-explicit-any
  admin: any,
  // deno-lint-ignore no-explicit-any
  current: any,
  // deno-lint-ignore no-explicit-any
  restaurant: any,
  body: ManageRequest,
  tz: string,
  userId: string,
) {
  // Only allow updates on non-final statuses
  if (["completed", "cancelled", "no_show"].includes(current.status)) {
    return json({
      error: "Deze reservering kan niet worden gewijzigd omdat de status definitief is.",
      reason_code: "final_status",
    }, 409);
  }

  const newPartySize = body.party_size ?? current.party_size;
  if (newPartySize < 1) return json({ error: "Controleer het aantal personen.", reason_code: "invalid_input" }, 400);

  const newDate = body.reservation_date ?? current.reservation_date;
  // Compute new start_iso
  let start_iso = current.start_time;
  let end_iso = current.end_time;
  const timeOrPartyOrDateChanged =
    !!body.start_time_local || !!body.reservation_date || (body.party_size !== undefined && body.party_size !== current.party_size);

  if (timeOrPartyOrDateChanged) {
    const localTime = body.start_time_local
      ?? new Date(current.start_time).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: tz, hour12: false });
    start_iso = zonedDateTimeToUtcIso(newDate, localTime, tz);
    const duration = durationFor(newPartySize, {
      default_minutes: restaurant.default_reservation_minutes ?? 105,
      large_group_minutes: restaurant.large_group_minutes ?? 150,
      large_group_threshold: restaurant.large_group_threshold ?? 9,
      extra_large_group_threshold: restaurant.extra_large_group_threshold ?? null,
      large_group_extra_minutes: restaurant.large_group_extra_minutes ?? 0,
    });
    end_iso = addMinutesIso(start_iso, duration);
  }

  // Determine candidate table
  const currentTableId = current.reservation_tables?.[0]?.table_id ?? null;
  const targetTableId = body.table_id !== undefined ? body.table_id : currentTableId;

  // Re-check conflicts if anything time/party/table-related changed
  if (timeOrPartyOrDateChanged || body.table_id !== undefined) {
    // fetch tables fitting party size
    const { data: tables } = await admin
      .from("tables").select("id, capacity_min, capacity_max")
      .eq("restaurant_id", current.restaurant_id).eq("is_active", true)
      .lte("capacity_min", newPartySize).gte("capacity_max", newPartySize)
      .order("capacity_max", { ascending: true });

    if (!tables || tables.length === 0) {
      return json({
        error: "Er is geen passende tafel vrij voor dit gezelschap.",
        reason_code: "no_table_available",
      }, 409);
    }

    // overlapping reservations
    const { data: existing } = await admin
      .from("reservations")
      .select("id, start_time, end_time, party_size, status, hold_expires_at, reservation_tables(table_id)")
      .eq("restaurant_id", current.restaurant_id)
      .neq("id", current.id)
      .gte("start_time", addMinutesIso(start_iso, -240))
      .lte("start_time", addMinutesIso(end_iso, 240))
      .in("status", ACTIVE_STATUSES as unknown as string[]);

    const now = new Date();
    // deno-lint-ignore no-explicit-any
    const live = (existing ?? []).filter((r: any) =>
      r.status !== "hold" || (r.hold_expires_at && new Date(r.hold_expires_at) > now)
    );
    const occupied = new Set<string>();
    for (const r of live) {
      if (intervalsOverlap(start_iso, end_iso, r.start_time, r.end_time)) {
        for (const rt of (r.reservation_tables ?? [])) occupied.add(rt.table_id);
      }
    }

    // Choose table
    let chosenTableId = targetTableId;
    if (chosenTableId) {
      // Validate chosen table fits & is free
      // deno-lint-ignore no-explicit-any
      const ok = tables.find((t: any) => t.id === chosenTableId);
      if (!ok) {
        return json({ error: "Deze tafel past niet bij het gezelschap.", reason_code: "no_table_available" }, 409);
      }
      if (occupied.has(chosenTableId)) {
        return json({ error: "Deze tafel is al bezet in dit tijdslot.", reason_code: "no_table_available" }, 409);
      }
    } else {
      // deno-lint-ignore no-explicit-any
      const candidate = (tables as any[]).find((t) => !occupied.has(t.id));
      if (!candidate) {
        return json({
          error: "Er is geen passende tafel vrij voor dit moment.",
          reason_code: "no_table_available",
        }, 409);
      }
      chosenTableId = candidate.id;
    }

    // Pacing check (skip for walk_in / manager)
    if (!["walk_in", "manager"].includes(current.channel)) {
      // deno-lint-ignore no-explicit-any
      const pacingRows: PacingReservation[] = (live as any[]).map((r) => ({
        id: r.id,
        start_time: r.start_time,
        end_time: r.end_time,
        party_size: r.party_size ?? 0,
        status: r.status,
        hold_expires_at: r.hold_expires_at,
      }));
      const pacing = evaluatePacing(
        { start_iso, end_iso, party_size: newPartySize },
        pacingRows,
        {
          max_covers_per_slot: restaurant.max_covers_per_slot ?? null,
          max_new_reservations_per_15min: restaurant.max_new_reservations_per_15min ?? null,
          peak_warning_threshold_pct: restaurant.peak_warning_threshold_pct ?? 85,
        },
        current.id,
      );
      if (!pacing.ok) {
        return json({
          error: "Dit moment wordt operationeel te druk. Kies een iets eerder of later tijdstip.",
          reason_code: "pacing_limit_reached",
        }, 409);
      }
    }

    // Update reservation
    // deno-lint-ignore no-explicit-any
    const patch: Record<string, any> = {
      reservation_date: newDate,
      start_time: start_iso,
      end_time: end_iso,
      party_size: newPartySize,
    };
    if (body.internal_notes !== undefined) patch.internal_notes = body.internal_notes;
    if (body.special_requests !== undefined) patch.special_requests = body.special_requests;

    const { data: updated, error: uErr } = await admin
      .from("reservations").update(patch).eq("id", current.id).select("*").single();
    if (uErr) return json({ error: uErr.message }, 500);

    // Re-link table if changed
    if (chosenTableId !== currentTableId) {
      await admin.from("reservation_tables").delete().eq("reservation_id", current.id);
      if (chosenTableId) {
        const { error: rtErr } = await admin.from("reservation_tables")
          .insert({ reservation_id: current.id, table_id: chosenTableId });
        if (rtErr) return json({ error: "Tafel niet gekoppeld: " + rtErr.message }, 500);
      }
    }

    await logAudit(admin, current.restaurant_id, userId, "reservation.updated", current.id, current, updated);
    await emitEvent(admin, current.restaurant_id, "reservation.updated", {
      reservation_id: current.id, party_size: newPartySize, start_time: start_iso,
    });
    return json({ ok: true, reservation: updated, table_id: chosenTableId });
  }

  // Plain field-only update (notes etc.)
  // deno-lint-ignore no-explicit-any
  const patch: Record<string, any> = {};
  if (body.internal_notes !== undefined) patch.internal_notes = body.internal_notes;
  if (body.special_requests !== undefined) patch.special_requests = body.special_requests;
  if (Object.keys(patch).length === 0) return json({ ok: true, reservation: current, unchanged: true });

  const { data: updated, error } = await admin
    .from("reservations").update(patch).eq("id", current.id).select("*").single();
  if (error) return json({ error: error.message }, 500);
  await logAudit(admin, current.restaurant_id, userId, "reservation.updated", current.id, current, updated);
  return json({ ok: true, reservation: updated });
}

// deno-lint-ignore no-explicit-any
async function logAudit(admin: any, restaurantId: string, userId: string, action: string, entityId: string, before: unknown, after: unknown) {
  try {
    await admin.from("audit_log").insert({
      restaurant_id: restaurantId,
      actor_user_id: userId,
      actor_label: "operator",
      action,
      entity: "reservation",
      entity_id: entityId,
      before_data: before,
      after_data: after,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

// deno-lint-ignore no-explicit-any
async function emitEvent(admin: any, restaurantId: string, eventType: string, payload: unknown) {
  try {
    await admin.from("integration_events").insert({
      restaurant_id: restaurantId,
      event_type: eventType,
      target: "clickwise",
      payload,
    });
  } catch (e) {
    console.error("integration event failed", e);
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Approve / decline a large-group reservation. Approval moves pending → confirmed
// and clears requires_manual_approval; decline cancels with a friendly reason.
async function doLargeGroupDecision(
  // deno-lint-ignore no-explicit-any
  admin: any,
  // deno-lint-ignore no-explicit-any
  current: any,
  decision: "approve" | "decline",
  userId: string,
  reason?: string,
) {
  if (["completed", "cancelled", "no_show"].includes(current.status)) {
    return json({
      error: "Deze groepsreservering kan niet meer beoordeeld worden.",
      reason_code: "final_status",
    }, 409);
  }
  if (decision === "approve") {
    const patch = {
      status: current.status === "pending" ? "confirmed" : current.status,
      requires_manual_approval: false,
      large_group_status: "approved",
    };
    const { data: updated, error } = await admin
      .from("reservations").update(patch).eq("id", current.id).select("*").single();
    if (error) return json({ error: error.message }, 500);
    await logAudit(admin, current.restaurant_id, userId, "reservation.large_group_approved", current.id, current, updated);
    await emitEvent(admin, current.restaurant_id, "reservation.large_group_approved", {
      reservation_id: current.id, party_size: current.party_size, start_time: current.start_time,
    });
    return json({ ok: true, reservation: updated });
  }
  // decline → cancel
  const patch = {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason ?? "Groepsaanvraag afgewezen",
    large_group_status: "declined",
    requires_manual_approval: false,
  };
  const { data: updated, error } = await admin
    .from("reservations").update(patch).eq("id", current.id).select("*").single();
  if (error) return json({ error: error.message }, 500);
  await logAudit(admin, current.restaurant_id, userId, "reservation.large_group_declined", current.id, current, updated);
  await emitEvent(admin, current.restaurant_id, "reservation.large_group_declined", {
    reservation_id: current.id, party_size: current.party_size, start_time: current.start_time,
    reason: reason ?? null,
  });
  return json({ ok: true, reservation: updated });
}

// ----- No-show prevention: reconfirmation flow -----
// state machine: not_required → pending → requested → confirmed | declined | expired
async function doReconfirmation(
  // deno-lint-ignore no-explicit-any
  admin: any,
  // deno-lint-ignore no-explicit-any
  current: any,
  decision: "requested" | "confirmed" | "declined",
  userId: string,
  reason?: string,
) {
  if (["completed", "cancelled", "no_show"].includes(current.status)) {
    return json({
      error: "Deze reservering kan niet meer herbevestigd worden.",
      reason_code: "final_status",
    }, 409);
  }

  // deno-lint-ignore no-explicit-any
  const patch: Record<string, any> = { reconfirmation_status: decision };
  let auditAction = `reservation.reconfirmation_${decision}`;
  let eventType = `reservation.reconfirmation_${decision}`;

  if (decision === "requested") {
    patch.reconfirmation_requested_at = new Date().toISOString();
    eventType = "reservation.reconfirmation_requested";
    auditAction = "reservation.reconfirmation_requested";
  } else if (decision === "confirmed") {
    patch.reconfirmed_at = new Date().toISOString();
    eventType = "reservation.reconfirmed";
    auditAction = "reservation.reconfirmed";
  } else if (decision === "declined") {
    // Guest can't come anymore — cancel the reservation as a side-effect.
    patch.reconfirmation_declined_at = new Date().toISOString();
    patch.status = "cancelled";
    patch.cancelled_at = new Date().toISOString();
    patch.cancellation_reason = reason ?? "guest_declined_reconfirmation";
    eventType = "reservation.reconfirmation_declined";
    auditAction = "reservation.reconfirmation_declined";
  }

  const { data: updated, error } = await admin
    .from("reservations").update(patch).eq("id", current.id).select("*").single();
  if (error) return json({ error: error.message }, 500);

  await logAudit(admin, current.restaurant_id, userId, auditAction, current.id, current, updated);
  await emitEvent(admin, current.restaurant_id, eventType, {
    reservation_id: current.id,
    party_size: current.party_size,
    start_time: current.start_time,
    reason: reason ?? null,
  });

  if (decision === "declined") {
    // Surface waitlist-fill opportunity downstream.
    await emitEvent(admin, current.restaurant_id, "reservation.cancelled_by_guest", {
      reservation_id: current.id,
      party_size: current.party_size,
      start_time: current.start_time,
    });
  }

  return json({ ok: true, reservation: updated });
}

// ----- Deposits / reserveringsgarantie -----
// MVP: operator sets the status manually — no payment provider yet.
async function doSetDepositStatus(
  // deno-lint-ignore no-explicit-any
  admin: any,
  // deno-lint-ignore no-explicit-any
  current: any,
  body: ManageRequest,
  userId: string,
) {
  const next = body.deposit_status;
  if (!next) return json({ error: "deposit_status vereist", reason_code: "invalid_input" }, 400);
  const allowed = ["not_required","recommended","required","pending","paid","waived","refunded","failed"];
  if (!allowed.includes(next)) {
    return json({ error: "Onbekende deposit status", reason_code: "invalid_input" }, 400);
  }
  if (body.deposit_amount_cents !== undefined && body.deposit_amount_cents < 0) {
    return json({ error: "Bedrag mag niet negatief zijn", reason_code: "invalid_input" }, 400);
  }

  // deno-lint-ignore no-explicit-any
  const patch: Record<string, any> = {
    deposit_status: next,
    deposit_required: next === "required" || next === "pending",
  };
  if (body.deposit_amount_cents !== undefined) patch.deposit_amount_cents = body.deposit_amount_cents;
  if (body.deposit_policy_notes !== undefined) patch.deposit_policy_notes = body.deposit_policy_notes;

  const { data: updated, error } = await admin
    .from("reservations").update(patch).eq("id", current.id).select("*").single();
  if (error) return json({ error: error.message }, 500);

  const eventMap: Record<string, string> = {
    recommended: "reservation.deposit_recommended",
    required: "reservation.deposit_required",
    waived: "reservation.deposit_waived",
    paid: "reservation.deposit_paid",
    refunded: "reservation.deposit_refunded",
  };
  const eventType = eventMap[next] ?? "reservation.deposit_updated";

  await logAudit(admin, current.restaurant_id, userId, eventType, current.id, current, updated);
  await emitEvent(admin, current.restaurant_id, eventType, {
    reservation_id: current.id,
    deposit_status: next,
    amount_cents: updated.deposit_amount_cents ?? null,
  });
  return json({ ok: true, reservation: updated });
}
