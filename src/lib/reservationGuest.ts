// Resolve the guest display fields for a reservation.
// Prefers the snapshot taken at booking time (so historic reservations don't
// change name/contact when the same email re-books later) and falls back to
// the currently linked guests row for older reservations or imports.
export type ReservationGuestLike = {
  guest_first_name?: string | null;
  guest_last_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  guests?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export type ResolvedGuest = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  full_name: string;
};

export function resolveReservationGuest(r: ReservationGuestLike): ResolvedGuest {
  const first = r.guest_first_name ?? r.guests?.first_name ?? null;
  const last  = r.guest_last_name  ?? r.guests?.last_name  ?? null;
  const email = r.guest_email      ?? r.guests?.email      ?? null;
  const phone = r.guest_phone      ?? r.guests?.phone      ?? null;
  const full_name = [first, last].filter(Boolean).join(" ").trim();
  return { first_name: first, last_name: last, email, phone, full_name };
}
