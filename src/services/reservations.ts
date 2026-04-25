// Reservation service layer — single point of truth for reservation operations
// from the operator UI. Wraps Supabase + edge functions and returns typed results.
//
// Why a service layer?
// - Centralizes business rules (status checks, error mapping, audit/event triggering)
// - Lets the public widget, AI Host and ClickWise reuse the same engine later
// - Keeps UI components free of scattered supabase.from() calls

import { supabase } from "@/integrations/supabase/client";

export type ManageAction =
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

export type DepositStatus =
  | "not_required" | "recommended" | "required" | "pending"
  | "paid" | "waived" | "refunded" | "failed";

export type ReservationStatus =
  | "hold" | "pending" | "confirmed" | "seated"
  | "completed" | "cancelled" | "no_show";

export type ManagePayload = {
  action: ManageAction;
  reservation_id: string;
  reservation_date?: string;
  start_time_local?: string;
  party_size?: number;
  table_id?: string | null;
  internal_notes?: string | null;
  special_requests?: string | null;
  new_status?: ReservationStatus;
  cancellation_reason?: string;
  deposit_status?: DepositStatus;
  deposit_amount_cents?: number;
  deposit_policy_notes?: string;
};

export type ManageResult = {
  ok: boolean;
  error?: string;
  reason_code?:
    | "no_table_available"
    | "pacing_limit_reached"
    | "invalid_transition"
    | "final_status"
    | "invalid_input"
    | "unknown_error";
  reservation?: Record<string, unknown>;
  table_id?: string | null;
};

/**
 * Send a reservation management action through the edge function.
 * Always re-runs availability + conflict checks server-side.
 */
export async function manageReservation(payload: ManagePayload): Promise<ManageResult> {
  const { data, error } = await supabase.functions.invoke("manage_reservation", { body: payload });
  if (error) {
    // Edge function non-2xx still returns a body; surface the user-facing message
    const fnErr = (data as { error?: string; reason_code?: ManageResult["reason_code"] }) || {};
    return {
      ok: false,
      error: fnErr.error || error.message || "De reservering is niet opgeslagen. Probeer het opnieuw.",
      reason_code: fnErr.reason_code ?? "unknown_error",
    };
  }
  if (data?.error) {
    return { ok: false, error: data.error, reason_code: data.reason_code };
  }
  return { ok: true, reservation: data?.reservation, table_id: data?.table_id };
}

/** Convenience helpers that map directly to operator buttons. */
export const reservations = {
  manage: manageReservation,
  cancel: (id: string, reason?: string) =>
    manageReservation({ action: "cancel", reservation_id: id, cancellation_reason: reason }),
  markSeated: (id: string) =>
    manageReservation({ action: "mark_seated", reservation_id: id }),
  markCompleted: (id: string) =>
    manageReservation({ action: "mark_completed", reservation_id: id }),
  markNoShow: (id: string) =>
    manageReservation({ action: "mark_no_show", reservation_id: id }),
  changeStatus: (id: string, newStatus: ReservationStatus) =>
    manageReservation({ action: "change_status", reservation_id: id, new_status: newStatus }),
  approveLargeGroup: (id: string) =>
    manageReservation({ action: "approve_large_group", reservation_id: id }),
  declineLargeGroup: (id: string, reason?: string) =>
    manageReservation({ action: "decline_large_group", reservation_id: id, cancellation_reason: reason }),
  markReconfirmed: (id: string) =>
    manageReservation({ action: "mark_reconfirmed", reservation_id: id }),
  markReconfirmationDeclined: (id: string, reason?: string) =>
    manageReservation({ action: "mark_reconfirmation_declined", reservation_id: id, cancellation_reason: reason }),
  requestReconfirmation: (id: string) =>
    manageReservation({ action: "request_reconfirmation", reservation_id: id }),
  setDepositStatus: (id: string, deposit_status: DepositStatus, fields?: { deposit_amount_cents?: number; deposit_policy_notes?: string }) =>
    manageReservation({ action: "set_deposit_status", reservation_id: id, deposit_status, ...fields }),
  update: (
    id: string,
    fields: Partial<Pick<ManagePayload,
      "reservation_date" | "start_time_local" | "party_size" |
      "table_id" | "internal_notes" | "special_requests">>,
  ) => manageReservation({ action: "update", reservation_id: id, ...fields }),
};
