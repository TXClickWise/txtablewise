// ReservationService — Ronde 4 abstractie.
// Eén consistente facade voor check / book / cancel / reschedule.
// Hergebruikt bestaande edge functions (availability, book_reservation, manage_reservation)
// en de bestaande `reservations` helper. Geen tweede reserveringssysteem — alleen één
// vaste plek waar UI-componenten hun reserveringsacties vandaan halen.

import { supabase } from "@/integrations/supabase/client";
import { reservations, type ReservationStatus } from "./reservations";

export type CheckInput = {
  restaurantId: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  partySize: number;
};

export type CheckResult = {
  ok: boolean;
  available: boolean;
  alternatives?: Array<{ time: string; reason?: string }>;
  reason?: string;
  raw?: unknown;
};

export type BookInput = {
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
  contact: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  };
  specialRequests?: string;
  source?: string; // source_channel
  externalReference?: string;
};

export type BookResult = {
  ok: boolean;
  reservationId?: string;
  status?: ReservationStatus;
  error?: string;
  reasonCode?: string;
  alternatives?: Array<{ time: string }>;
};

export type RescheduleInput = {
  reservationId: string;
  newDate: string;
  newTime: string;
  newPartySize?: number;
};

/** Check availability via the public availability edge function. */
async function check(input: CheckInput): Promise<CheckResult> {
  try {
    const { data, error } = await supabase.functions.invoke("availability", {
      body: {
        restaurant_id: input.restaurantId,
        date: input.date,
        time: input.time,
        party_size: input.partySize,
      },
    });
    if (error) {
      return { ok: false, available: false, reason: error.message };
    }
    const available = !!data?.available;
    return {
      ok: true,
      available,
      alternatives: data?.alternatives ?? data?.suggested_times,
      reason: data?.reason,
      raw: data,
    };
  } catch (e: any) {
    return { ok: false, available: false, reason: e?.message ?? "network_error" };
  }
}

/** Book through the existing book_reservation edge function. */
async function book(input: BookInput): Promise<BookResult> {
  try {
    const { data, error } = await supabase.functions.invoke("book_reservation", {
      body: {
        restaurant_id: input.restaurantId,
        reservation_date: input.date,
        start_time_local: input.time,
        party_size: input.partySize,
        guest_full_name:
          input.contact.fullName ||
          ([input.contact.firstName, input.contact.lastName].filter(Boolean).join(" ").trim() ||
            undefined),
        guest_phone: input.contact.phone,
        guest_email: input.contact.email,
        special_requests: input.specialRequests,
        source_channel: input.source ?? "manual_phone",
        external_reference: input.externalReference,
      },
    });
    if (error) {
      const body = (data as any) || {};
      return {
        ok: false,
        error: body.error ?? error.message ?? "Boeken mislukt",
        reasonCode: body.reason_code,
        alternatives: body.alternatives,
      };
    }
    if (data?.error) {
      return {
        ok: false,
        error: data.error,
        reasonCode: data.reason_code,
        alternatives: data.alternatives,
      };
    }
    return {
      ok: true,
      reservationId: data?.reservation?.id ?? data?.id,
      status: data?.reservation?.status ?? data?.status,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Onverwachte fout" };
  }
}

/** Cancel via the manage_reservation edge function. */
async function cancel(reservationId: string, reason?: string) {
  return reservations.cancel(reservationId, reason);
}

/** Reschedule via the manage_reservation edge function (update action). */
async function reschedule(input: RescheduleInput) {
  return reservations.update(input.reservationId, {
    reservation_date: input.newDate,
    start_time_local: input.newTime,
    party_size: input.newPartySize,
  });
}

export const reservationService = {
  check,
  book,
  cancel,
  reschedule,
};
