// Guest CRM service — hospitality-first, privacy-aware.
// Geen echte ClickWise API — alleen integration_events + audit_log voor latere sync.
import { supabase } from "@/integrations/supabase/client";

export type Guest = {
  id: string;
  restaurant_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  language: string;
  preferred_channel: string | null;
  source_channel: string | null;
  is_vip: boolean;
  is_blacklisted: boolean;
  total_visits: number;
  visit_count: number;
  no_show_count: number;
  marketing_consent: boolean;
  allergies: string | null;
  dietary_preferences: string | null;
  seating_preferences: string | null;
  hospitality_notes: string | null;
  notes: string | null;
  tags: string[];
  clickwise_contact_id: string | null;
  last_visit_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GuestNote = {
  id: string;
  guest_id: string;
  restaurant_id: string;
  note: string;
  note_type: string | null;
  created_by: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type GuestNoteType =
  | "general" | "allergy" | "preference" | "service" | "complaint" | "special_occasion" | "internal";

export const NOTE_TYPE_LABEL: Record<GuestNoteType, string> = {
  general: "Algemeen",
  allergy: "Allergie",
  preference: "Voorkeur",
  service: "Service",
  complaint: "Klacht",
  special_occasion: "Speciale gelegenheid",
  internal: "Intern",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (e: string) => !e || EMAIL_RE.test(e.trim());
export const normalizePhone = (p: string | null | undefined) =>
  (p ?? "").replace(/[^\d+]/g, "").replace(/^00/, "+");
export const normalizeEmail = (e: string | null | undefined) =>
  (e ?? "").trim().toLowerCase();

// ----- audit + events -----

async function logAudit(restaurantId: string, action: string, entityId: string | null, data?: { before?: unknown; after?: unknown }) {
  try {
    await supabase.from("audit_log").insert([{
      restaurant_id: restaurantId,
      action,
      entity: "guest",
      entity_id: entityId,
      before_data: (data?.before ?? null) as never,
      after_data: (data?.after ?? null) as never,
    }]);
  } catch { /* non-fatal */ }
}

async function logEvent(restaurantId: string, eventType: string, payload: Record<string, unknown>) {
  try {
    await supabase.from("integration_events").insert([{
      restaurant_id: restaurantId,
      event_type: eventType,
      payload: payload as never,
      status: "pending" as const,
    }]);
  } catch { /* non-fatal */ }
}

// ----- CRUD -----

export type GuestInput = Partial<Pick<Guest,
  "first_name" | "last_name" | "email" | "phone" | "language" | "preferred_channel" |
  "is_vip" | "marketing_consent" | "allergies" | "dietary_preferences" |
  "seating_preferences" | "hospitality_notes" | "notes" | "tags" | "source_channel"
>>;

export async function createGuest(restaurantId: string, input: GuestInput) {
  if (!input.first_name?.trim() && !input.last_name?.trim() && !input.phone?.trim() && !input.email?.trim()) {
    throw new Error("Vul minimaal een naam, telefoonnummer of e-mailadres in.");
  }
  if (input.email && !isValidEmail(input.email)) {
    throw new Error("Dit e-mailadres lijkt niet geldig.");
  }
  const fullName = [input.first_name, input.last_name].filter(Boolean).join(" ").trim() || null;
  const { data, error } = await supabase.from("guests").insert([{
    restaurant_id: restaurantId,
    first_name: input.first_name?.trim() || null,
    last_name: input.last_name?.trim() || null,
    full_name: fullName,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    language: input.language ?? "nl",
    preferred_channel: input.preferred_channel ?? null,
    source_channel: input.source_channel ?? null,
    is_vip: input.is_vip ?? false,
    marketing_consent: input.marketing_consent ?? false,
    allergies: input.allergies?.trim() || null,
    dietary_preferences: input.dietary_preferences?.trim() || null,
    seating_preferences: input.seating_preferences?.trim() || null,
    hospitality_notes: input.hospitality_notes?.trim() || null,
    notes: input.notes?.trim() || null,
    tags: input.tags ?? [],
  }]).select("*").single();
  if (error) throw error;
  await logAudit(restaurantId, "guest.created", data.id, { after: data });
  await logEvent(restaurantId, "guest.created", { guest_id: data.id });
  return data as Guest;
}

export async function updateGuest(restaurantId: string, id: string, patch: GuestInput) {
  const { data: before } = await supabase.from("guests").select("*").eq("id", id).maybeSingle();
  if (patch.email && !isValidEmail(patch.email)) {
    throw new Error("Dit e-mailadres lijkt niet geldig.");
  }
  const fullName = [patch.first_name, patch.last_name].filter(Boolean).join(" ").trim();
  const { data, error } = await supabase.from("guests").update({
    first_name: patch.first_name,
    last_name: patch.last_name,
    full_name: fullName || undefined,
    email: patch.email,
    phone: patch.phone,
    language: patch.language,
    preferred_channel: patch.preferred_channel,
    is_vip: patch.is_vip,
    marketing_consent: patch.marketing_consent,
    allergies: patch.allergies,
    dietary_preferences: patch.dietary_preferences,
    seating_preferences: patch.seating_preferences,
    hospitality_notes: patch.hospitality_notes,
    notes: patch.notes,
    tags: patch.tags,
  }).eq("id", id).select("*").single();
  if (error) throw error;
  await logAudit(restaurantId, "guest.updated", id, { before, after: data });
  await logEvent(restaurantId, "guest.updated", { guest_id: id });
  // Specific events for sensitive flags
  if (before && before.is_vip !== data.is_vip) {
    await logEvent(restaurantId, "guest.vip_updated", { guest_id: id, is_vip: data.is_vip });
  }
  if (before && before.marketing_consent !== data.marketing_consent) {
    await logEvent(restaurantId, "guest.marketing_opt_in_updated",
      { guest_id: id, marketing_consent: data.marketing_consent });
  }
  return data as Guest;
}

export async function getGuest(id: string) {
  const { data, error } = await supabase.from("guests").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Guest | null;
}

// ----- search & matching -----

export async function findGuestByPhoneOrEmail(restaurantId: string, opts: { phone?: string | null; email?: string | null }) {
  const phone = normalizePhone(opts.phone ?? "");
  const email = normalizeEmail(opts.email ?? "");
  if (!phone && !email) return null;
  let q = supabase.from("guests").select("*").eq("restaurant_id", restaurantId).limit(1);
  if (phone) q = q.eq("phone", opts.phone!);
  else if (email) q = q.eq("email", email);
  const { data } = await q;
  return (data?.[0] ?? null) as Guest | null;
}

export async function detectPossibleDuplicates(
  restaurantId: string,
  opts: { phone?: string | null; email?: string | null; firstName?: string | null; excludeId?: string },
): Promise<Guest[]> {
  const filters: string[] = [];
  if (opts.phone) filters.push(`phone.eq.${opts.phone}`);
  if (opts.email) filters.push(`email.ilike.${opts.email}`);
  if (opts.firstName && opts.firstName.length >= 2) {
    filters.push(`first_name.ilike.${opts.firstName}`);
  }
  if (filters.length === 0) return [];
  let q = supabase.from("guests").select("*").eq("restaurant_id", restaurantId).limit(5);
  q = q.or(filters.join(","));
  if (opts.excludeId) q = q.neq("id", opts.excludeId);
  const { data } = await q;
  return (data ?? []) as Guest[];
}

export async function linkGuestToReservation(
  restaurantId: string,
  reservationId: string,
  guestId: string,
) {
  const { error } = await supabase.from("reservations")
    .update({ guest_id: guestId }).eq("id", reservationId);
  if (error) throw error;
  await logAudit(restaurantId, "guest.reservation_linked", guestId, { after: { reservation_id: reservationId } });
  await logEvent(restaurantId, "guest.reservation_linked", { guest_id: guestId, reservation_id: reservationId });
}

// ----- delete -----

export type DeleteGuestsResult = {
  deleted: string[];
  blocked: Array<{ guest_id: string; name: string | null; active_reservations: number }>;
};

export async function deleteGuests(guestIds: string[]): Promise<DeleteGuestsResult> {
  if (guestIds.length === 0) return { deleted: [], blocked: [] };
  const { data, error } = await supabase.rpc("delete_guests_safe", { _guest_ids: guestIds });
  if (error) throw error;
  const r = (data ?? {}) as { deleted?: string[]; blocked?: DeleteGuestsResult["blocked"] };
  return { deleted: r.deleted ?? [], blocked: r.blocked ?? [] };
}

// ----- notes -----

export async function listGuestNotes(guestId: string) {
  const { data, error } = await supabase.from("guest_notes")
    .select("*").eq("guest_id", guestId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GuestNote[];
}

export async function createGuestNote(
  restaurantId: string, guestId: string,
  input: { note: string; note_type?: GuestNoteType | null },
) {
  if (!input.note.trim()) throw new Error("Notitie mag niet leeg zijn.");
  const { data, error } = await supabase.from("guest_notes").insert([{
    restaurant_id: restaurantId,
    guest_id: guestId,
    note: input.note.trim(),
    note_type: input.note_type ?? "general",
  }]).select("*").single();
  if (error) throw error;
  await logAudit(restaurantId, "guest.note_added", guestId, { after: data });
  await logEvent(restaurantId, "guest.note_added", { guest_id: guestId, note_type: input.note_type ?? "general" });
  return data as GuestNote;
}

// ----- history -----

export async function getReservationHistory(guestId: string) {
  const { data, error } = await supabase.from("reservations")
    .select("id, reservation_date, start_time, party_size, status, channel, occasion, requires_manual_approval, large_group_status")
    .eq("guest_id", guestId)
    .order("start_time", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getWaitlistHistory(guestId: string) {
  const { data, error } = await supabase.from("waitlist_entries")
    .select("id, desired_date, desired_time_from, desired_time_to, party_size, status, created_at, converted_reservation_id")
    .eq("guest_id", guestId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getPreOrderHistory(guestId: string) {
  // pre_orders are linked via reservations.guest_id
  const { data: reservations } = await supabase.from("reservations")
    .select("id, reservation_date, start_time, pre_orders(id, item_name, quantity, status)")
    .eq("guest_id", guestId)
    .order("start_time", { ascending: false })
    .limit(50);
  const out: Array<{ reservationId: string; date: string; startTime: string; itemName: string; quantity: number; status: string }> = [];
  for (const r of (reservations ?? [])) {
    const list = (r.pre_orders ?? []) as Array<{ id: string; item_name: string; quantity: number; status: string }>;
    for (const po of list) {
      out.push({
        reservationId: r.id, date: r.reservation_date as string,
        startTime: r.start_time as string, itemName: po.item_name,
        quantity: po.quantity, status: po.status,
      });
    }
  }
  return out;
}

// ----- KPIs / list -----

export type GuestFilter =
  | "all" | "returning" | "new" | "vip" | "allergy" | "large_group"
  | "walk_in" | "no_show" | "marketing" | "whatsapp" | "email";

export async function listGuests(restaurantId: string, opts?: {
  search?: string;
  filter?: GuestFilter;
  limit?: number;
}): Promise<Guest[]> {
  let q = supabase.from("guests")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.search) {
    const s = opts.search.replace(/[%_]/g, "");
    q = q.or(
      `first_name.ilike.%${s}%,last_name.ilike.%${s}%,full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`,
    );
  }
  switch (opts?.filter) {
    case "vip":         q = q.eq("is_vip", true); break;
    case "marketing":   q = q.eq("marketing_consent", true); break;
    case "allergy":     q = q.not("allergies", "is", null); break;
    case "no_show":     q = q.gt("no_show_count", 0); break;
    case "returning":   q = q.gte("total_visits", 2); break;
    case "new":         q = q.lte("total_visits", 1); break;
    case "walk_in":     q = q.eq("source_channel", "walk_in"); break;
    case "whatsapp":    q = q.eq("preferred_channel", "whatsapp"); break;
    case "email":       q = q.eq("preferred_channel", "email"); break;
    default: break;
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Guest[];
}

export type GuestKpis = {
  total: number;
  returning: number;
  vip: number;
  allergy: number;
  newThisMonth: number;
  marketingOptIn: number;
};

export async function getGuestKpis(restaurantId: string): Promise<GuestKpis> {
  const since = new Date();
  since.setDate(1); since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const counts = await Promise.all([
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).is("deleted_at", null),
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).gte("total_visits", 2).is("deleted_at", null),
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("is_vip", true).is("deleted_at", null),
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).not("allergies", "is", null).is("deleted_at", null),
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).gte("created_at", sinceIso).is("deleted_at", null),
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("marketing_consent", true).is("deleted_at", null),
  ]);
  return {
    total:           counts[0].count ?? 0,
    returning:       counts[1].count ?? 0,
    vip:             counts[2].count ?? 0,
    allergy:         counts[3].count ?? 0,
    newThisMonth:    counts[4].count ?? 0,
    marketingOptIn:  counts[5].count ?? 0,
  };
}

// ----- ClickWise mapping preview -----

export type ClickWisePreview = {
  contactId: string | null;
  syncStatus: "not_connected";
  tags: string[];
  customFields: Record<string, string | number | null>;
  workflows: Array<{ name: string; status: "Voorbereid" | "Nog niet gekoppeld" }>;
};

export function getClickWiseGuestMappingPreview(guest: Guest, history: { last?: string | null; next?: string | null; largeGroups?: number }): ClickWisePreview {
  const tags: string[] = [];
  if (guest.total_visits >= 2) tags.push("returning_guest");
  if (guest.is_vip) tags.push("vip_guest");
  if (guest.allergies) tags.push("allergy");
  if ((guest.seating_preferences ?? "").toLowerCase().includes("terras")) tags.push("terrace_preference");
  if ((history.largeGroups ?? 0) > 0) tags.push("large_group_booker");
  if (guest.source_channel === "walk_in") tags.push("walk_in_guest");
  if (guest.no_show_count > 0) tags.push("no_show_history");
  if (guest.marketing_consent) tags.push("marketing_opt_in");
  return {
    contactId: guest.clickwise_contact_id ?? null,
    syncStatus: "not_connected",
    tags,
    customFields: {
      last_reservation_date: history.last ?? null,
      next_reservation_date: history.next ?? null,
      visit_count: guest.total_visits ?? 0,
      no_show_count: guest.no_show_count ?? 0,
      preferred_channel: guest.preferred_channel ?? null,
      seating_preferences: guest.seating_preferences ?? null,
      allergies: guest.allergies ?? null,
      last_source_channel: guest.source_channel ?? null,
      large_group_count: history.largeGroups ?? 0,
    },
    workflows: [
      { name: "Review request",         status: "Voorbereid" },
      { name: "Birthday flow",          status: "Voorbereid" },
      { name: "Winback flow",           status: "Voorbereid" },
      { name: "VIP invite",             status: guest.is_vip ? "Voorbereid" : "Nog niet gekoppeld" },
      { name: "No-show follow-up",      status: guest.no_show_count > 0 ? "Voorbereid" : "Nog niet gekoppeld" },
      { name: "Large group follow-up",  status: (history.largeGroups ?? 0) > 0 ? "Voorbereid" : "Nog niet gekoppeld" },
    ],
  };
}
