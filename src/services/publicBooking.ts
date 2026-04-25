// Public booking service — wraps the existing reservation engine for the
// guest-facing widget. The widget MUST never invent its own availability;
// it always defers to the `availability` and `book_reservation` edge functions.
//
// Responsibilities:
// - fetch availability slots
// - find alternative times near a (full) requested time
// - submit a reservation (re-checks availability server-side)
// - submit a waitlist entry as fallback
// - load active pre-order items for the restaurant
// - submit a large-group request

import { supabase } from "@/integrations/supabase/client";

export type Slot = {
  time: string;
  start_iso: string;
  end_iso: string;
  available: boolean;
  available_table_count: number;
  peak_warning?: boolean;
  reason?: "covers_full" | "rate_full" | "no_table";
};

export type AvailabilityResponse = {
  slots: Slot[];
  large_group?: boolean;
  closed?: boolean;
  message?: string;
  restaurant?: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    max_party_size_online: number;
    large_group_threshold: number;
  };
};

export type SourceChannel =
  | "website_widget"
  | "google_link"
  | "instagram_link"
  | "qr_code"
  | "external_platform";

export const KNOWN_SOURCES: SourceChannel[] = [
  "website_widget",
  "google_link",
  "instagram_link",
  "qr_code",
  "external_platform",
];

export function resolveSourceChannel(raw: string | null | undefined): {
  source_channel: SourceChannel;
  raw_source?: string;
} {
  if (!raw) return { source_channel: "website_widget" };
  const normalized = raw.toLowerCase().trim();
  if ((KNOWN_SOURCES as string[]).includes(normalized)) {
    return { source_channel: normalized as SourceChannel };
  }
  return { source_channel: "website_widget", raw_source: raw.slice(0, 80) };
}

export async function getAvailability(params: {
  restaurant_id: string;
  date: string;
  party_size: number;
}): Promise<AvailabilityResponse> {
  const { data, error } = await supabase.functions.invoke("availability", {
    body: params,
  });
  if (error) throw new Error(error.message);
  return data as AvailabilityResponse;
}

/**
 * Pick alternative times around a target time from the slot list.
 * Always derived from the engine response — never invented.
 */
export function pickAlternatives(slots: Slot[], targetTime: string, count = 4): Slot[] {
  const target = toMinutes(targetTime);
  return [...slots]
    .filter((s) => s.available && s.time !== targetTime)
    .map((s) => ({ slot: s, dist: Math.abs(toMinutes(s.time) - target) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count)
    .map((x) => x.slot);
}

export type BookPayload = {
  restaurant_id: string;
  date: string;
  time: string;
  party_size: number;
  guest: {
    first_name: string;
    last_name?: string;
    email?: string;
    phone?: string;
    language?: string;
  };
  special_requests?: string;
  dietary_notes?: string;
  occasion?: string;
  marketing_consent?: boolean;
  source_channel: SourceChannel;
  source_metadata?: Record<string, unknown>;
};

export type BookResult =
  | { ok: true; reservation: { id: string; confirmation_code: string; status: string; start_time: string; end_time: string; party_size: number; table_id: string } }
  | { ok: false; error: string; retry?: boolean; large_group?: boolean; pacing_full?: boolean };

export async function bookReservation(payload: BookPayload, preOrders: SelectedPreOrder[] = []): Promise<BookResult> {
  const { data, error } = await supabase.functions.invoke("book_reservation", {
    body: {
      restaurant_id: payload.restaurant_id,
      date: payload.date,
      time: payload.time,
      party_size: payload.party_size,
      guest: payload.guest,
      special_requests: payload.special_requests,
      dietary_notes: payload.dietary_notes,
      occasion: payload.occasion,
      marketing_consent: !!payload.marketing_consent,
      channel: "online",
      source_metadata: {
        source_channel: payload.source_channel,
        ...(payload.source_metadata ?? {}),
      },
    },
  });
  if (error) {
    return { ok: false, error: data?.error || error.message || "Reservering mislukt" };
  }
  if (data?.error) {
    return { ok: false, error: data.error, retry: data.retry, large_group: data.large_group, pacing_full: data.pacing_full };
  }

  // Attach pre-orders (best effort — does not break confirmation if it fails)
  if (preOrders.length > 0 && data?.reservation?.id) {
    try {
      await attachPreOrders(data.reservation.id, preOrders);
    } catch (e) {
      console.warn("Pre-order attach failed", e);
    }
  }

  return { ok: true, reservation: data.reservation };
}

export type PreOrderItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  category: string | null;
};

export type SelectedPreOrder = {
  item_id?: string;
  item_name: string;
  unit_price_cents: number;
  quantity: number;
  note?: string;
};

export async function getActivePreOrderItems(restaurantId: string): Promise<PreOrderItem[]> {
  const { data, error } = await supabase
    .from("pre_order_items")
    .select("id, name, description, price_cents, category, sort_order")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    id: d.id, name: d.name, description: d.description,
    price_cents: d.price_cents, category: d.category,
  }));
}

async function attachPreOrders(reservationId: string, items: SelectedPreOrder[]) {
  const rows = items.map((it) => ({
    reservation_id: reservationId,
    pre_order_item_id: it.item_id ?? null,
    item_name: it.item_name,
    quantity: Math.max(1, it.quantity),
    unit_price_cents: Math.max(0, it.unit_price_cents ?? 0),
    note: it.note ?? null,
    status: "requested",
  }));
  const { error } = await supabase.from("pre_orders").insert(rows);
  if (error) throw new Error(error.message);
}

export type WaitlistPayload = {
  restaurant_id: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  party_size: number;
  desired_date: string;
  desired_time_from: string; // HH:MM
  desired_time_to: string;   // HH:MM
  notes?: string;
  marketing_consent?: boolean;
  source_channel: SourceChannel;
};

export async function submitWaitlist(payload: WaitlistPayload): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("waitlist_entries").insert({
    restaurant_id: payload.restaurant_id,
    first_name: payload.first_name,
    last_name: payload.last_name ?? null,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    party_size: payload.party_size,
    desired_date: payload.desired_date,
    desired_time_from: payload.desired_time_from,
    desired_time_to: payload.desired_time_to,
    flexible_minutes: 30,
    notes: payload.notes ?? null,
    language: "nl",
    channel: "online",
    marketing_consent: !!payload.marketing_consent,
    source_metadata: { source_channel: payload.source_channel },
  });
  if (error) return { ok: false, error: error.message };

  // Best-effort integration event (RLS may block anonymous inserts here — that's ok)
  await supabase.from("integration_events").insert({
    restaurant_id: payload.restaurant_id,
    event_type: "waitlist.created",
    target: "clickwise",
    payload: { source: "public_widget", party_size: payload.party_size, desired_date: payload.desired_date },
  }).then(() => {}, () => {});

  return { ok: true };
}

function toMinutes(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
