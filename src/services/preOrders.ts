// Pre-order & hospitality upsell service
// All business logic for pre_order_items + pre_orders lives here.
// Operates as hospitality notes — geen echte betaling of POS-koppeling in MVP.
import { supabase } from "@/integrations/supabase/client";

export type PreOrderStatus = "requested" | "confirmed" | "prepared" | "served" | "cancelled";
export const PRE_ORDER_STATUSES: PreOrderStatus[] = [
  "requested", "confirmed", "prepared", "served", "cancelled",
];

export type PreOrderItem = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price_cents: number | null;
  is_active: boolean;
  requires_payment: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
  deleted_at: string | null;
};

export type ReservationPreOrder = {
  id: string;
  reservation_id: string;
  pre_order_item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price_cents: number;
  note: string | null;
  status: PreOrderStatus;
  created_at: string;
  updated_at: string;
};

export const PRE_ORDER_CATEGORIES = [
  "Aperitief", "Wijn", "Bier", "Alcoholvrij", "Cocktail",
  "Borrel", "Verjaardag", "Kinderen", "Overig",
] as const;

export const STANDARD_ITEMS: Array<Omit<PreOrderItem, "id" | "restaurant_id" | "metadata" | "deleted_at">> = [
  { name: "Prosecco per glas",       description: "Welkomstdrankje",        category: "Aperitief",   price_cents: 750,  is_active: true, requires_payment: false, sort_order: 10 },
  { name: "Alcoholvrije cocktail",   description: "Mocktail van het huis",  category: "Alcoholvrij", price_cents: 650,  is_active: true, requires_payment: false, sort_order: 20 },
  { name: "Fles huiswijn wit",       description: "Sauvignon",              category: "Wijn",        price_cents: 2600, is_active: true, requires_payment: false, sort_order: 30 },
  { name: "Speciaalbier lokaal",     description: "Op fles",                category: "Bier",        price_cents: 500,  is_active: true, requires_payment: false, sort_order: 40 },
  { name: "Cocktail van de maand",   description: "Vraag bediening",        category: "Cocktail",    price_cents: 1100, is_active: true, requires_payment: false, sort_order: 50 },
  { name: "Borrelplank",             description: "Voor 2-4 personen",      category: "Borrel",      price_cents: 1850, is_active: true, requires_payment: false, sort_order: 60 },
  { name: "Verjaardagsdessert",      description: "Met kaarsje",            category: "Verjaardag",  price_cents: 750,  is_active: true, requires_payment: false, sort_order: 70 },
  { name: "Kinderlimonade",          description: "Diverse smaken",         category: "Kinderen",    price_cents: 250,  is_active: true, requires_payment: false, sort_order: 80 },
];

const STATUS_LABEL: Record<PreOrderStatus, string> = {
  requested: "Wens ontvangen",
  confirmed: "Bevestigd",
  prepared:  "Klaar",
  served:    "Geserveerd",
  cancelled: "Geannuleerd",
};

export const preOrderStatusLabel = (s: PreOrderStatus) => STATUS_LABEL[s] ?? s;

export const formatPrice = (cents: number | null | undefined) => {
  if (cents == null) return null;
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
};

// ---- audit + integration helpers ----

async function logEvent(restaurantId: string, eventType: string, payload: Record<string, unknown>) {
  try {
    await supabase.from("integration_events").insert({
      restaurant_id: restaurantId,
      event_type: eventType,
      payload,
      status: "pending",
    });
  } catch { /* non-fatal */ }
}

async function logAudit(
  restaurantId: string,
  action: string,
  entity: string,
  entityId: string | null,
  data?: { before?: unknown; after?: unknown },
) {
  try {
    await supabase.from("audit_log").insert({
      restaurant_id: restaurantId,
      action,
      entity,
      entity_id: entityId,
      before_data: (data?.before ?? null) as never,
      after_data: (data?.after ?? null) as never,
    });
  } catch { /* non-fatal */ }
}

// ---- pre_order_items CRUD ----

export async function listItems(restaurantId: string, opts?: { includeInactive?: boolean }) {
  let q = supabase.from("pre_order_items")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (!opts?.includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PreOrderItem[];
}

export async function createItem(restaurantId: string, input: Partial<PreOrderItem> & { name: string }) {
  const { data, error } = await supabase.from("pre_order_items").insert({
    restaurant_id: restaurantId,
    name: input.name.trim(),
    description: input.description ?? null,
    category: input.category ?? null,
    price_cents: input.price_cents ?? null,
    is_active: input.is_active ?? true,
    requires_payment: input.requires_payment ?? false,
    sort_order: input.sort_order ?? 100,
  }).select("*").single();
  if (error) throw error;
  await logAudit(restaurantId, "pre_order.item_created", "pre_order_item", data.id, { after: data });
  await logEvent(restaurantId, "pre_order.item_created", { item_id: data.id, name: data.name });
  return data as PreOrderItem;
}

export async function updateItem(restaurantId: string, id: string, patch: Partial<PreOrderItem>) {
  const { data: before } = await supabase.from("pre_order_items").select("*").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("pre_order_items").update({
    name: patch.name,
    description: patch.description,
    category: patch.category,
    price_cents: patch.price_cents,
    is_active: patch.is_active,
    requires_payment: patch.requires_payment,
    sort_order: patch.sort_order,
  }).eq("id", id).select("*").single();
  if (error) throw error;
  await logAudit(restaurantId, "pre_order.item_updated", "pre_order_item", id, { before, after: data });
  await logEvent(restaurantId, "pre_order.item_updated", { item_id: id });
  return data as PreOrderItem;
}

export async function archiveItem(restaurantId: string, id: string) {
  const { error } = await supabase.from("pre_order_items")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id);
  if (error) throw error;
  await logAudit(restaurantId, "pre_order.item_updated", "pre_order_item", id, { after: { deleted: true } });
}

export async function seedStandardItems(restaurantId: string) {
  const existing = await listItems(restaurantId, { includeInactive: true });
  const existingNames = new Set(existing.map((i) => i.name.toLowerCase()));
  const toCreate = STANDARD_ITEMS.filter((i) => !existingNames.has(i.name.toLowerCase()));
  if (toCreate.length === 0) return 0;
  const { error } = await supabase.from("pre_order_items").insert(
    toCreate.map((i) => ({ ...i, restaurant_id: restaurantId })),
  );
  if (error) throw error;
  await logEvent(restaurantId, "pre_order.item_created", { seeded: toCreate.length });
  return toCreate.length;
}

// ---- reservation pre-orders ----

export async function listForReservation(reservationId: string) {
  const { data, error } = await supabase.from("pre_orders")
    .select("*")
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReservationPreOrder[];
}

export type AddPreOrderInput = {
  reservationId: string;
  restaurantId: string;
  itemId?: string | null;
  customItemName?: string | null;
  quantity: number;
  note?: string | null;
};

export async function addPreOrder(input: AddPreOrderInput) {
  if (input.quantity < 1) throw new Error("Aantal moet minimaal 1 zijn.");
  let itemName = input.customItemName?.trim() || "";
  let unitPrice = 0;
  if (input.itemId) {
    const { data: item, error } = await supabase.from("pre_order_items")
      .select("name, price_cents").eq("id", input.itemId).maybeSingle();
    if (error) throw error;
    if (!item) throw new Error("Gekozen item bestaat niet meer.");
    itemName = item.name;
    unitPrice = item.price_cents ?? 0;
  }
  if (!itemName) throw new Error("Kies een item of vul een vrije wens in.");

  const { data, error } = await supabase.from("pre_orders").insert({
    reservation_id: input.reservationId,
    pre_order_item_id: input.itemId ?? null,
    item_name: itemName,
    quantity: input.quantity,
    unit_price_cents: unitPrice,
    note: input.note?.trim() || null,
    status: "requested",
  }).select("*").single();
  if (error) throw error;

  await logAudit(input.restaurantId, "pre_order.added", "pre_order", data.id, { after: data });
  await logEvent(input.restaurantId, "pre_order.added", {
    reservation_id: input.reservationId, pre_order_id: data.id,
    item_name: itemName, quantity: input.quantity,
  });
  await logEvent(input.restaurantId, "reservation.pre_order_added", {
    reservation_id: input.reservationId, pre_order_id: data.id,
  });
  return data as ReservationPreOrder;
}

export async function updatePreOrder(
  restaurantId: string,
  id: string,
  patch: Partial<Pick<ReservationPreOrder, "quantity" | "note" | "item_name">>,
) {
  if (patch.quantity != null && patch.quantity < 1) throw new Error("Aantal moet minimaal 1 zijn.");
  const { data: before } = await supabase.from("pre_orders").select("*").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("pre_orders").update({
    quantity: patch.quantity,
    note: patch.note ?? null,
    item_name: patch.item_name,
  }).eq("id", id).select("*").single();
  if (error) throw error;
  await logAudit(restaurantId, "pre_order.updated", "pre_order", id, { before, after: data });
  await logEvent(restaurantId, "pre_order.updated", { pre_order_id: id });
  return data as ReservationPreOrder;
}

export async function changeStatus(
  restaurantId: string,
  id: string,
  next: PreOrderStatus,
) {
  const { data: before } = await supabase.from("pre_orders").select("*").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("pre_orders")
    .update({ status: next }).eq("id", id).select("*").single();
  if (error) throw error;
  const action = next === "cancelled" ? "pre_order.cancelled"
    : next === "confirmed" ? "pre_order.confirmed"
    : next === "prepared" ? "pre_order.prepared"
    : next === "served" ? "pre_order.served"
    : "pre_order.status_changed";
  await logAudit(restaurantId, action, "pre_order", id, { before, after: data });
  await logEvent(restaurantId, action, { pre_order_id: id, status: next });
  return data as ReservationPreOrder;
}

export async function cancelPreOrder(restaurantId: string, id: string) {
  return changeStatus(restaurantId, id, "cancelled");
}

// ---- queries voor dagoverzicht / floor mode ----

export type ReadyListEntry = {
  preOrder: ReservationPreOrder;
  reservationId: string;
  startTime: string;
  partySize: number;
  guestName: string;
  tableLabels: string[];
  occasion: string | null;
};

export async function getReadyListForToday(restaurantId: string, date: string): Promise<ReadyListEntry[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(`
      id, start_time, party_size, occasion,
      guests:guests(first_name, last_name),
      reservation_tables(tables(label)),
      pre_orders(*)
    `)
    .eq("restaurant_id", restaurantId)
    .eq("reservation_date", date)
    .not("status", "in", "(cancelled,no_show)")
    .order("start_time", { ascending: true });
  if (error) throw error;
  const list: ReadyListEntry[] = [];
  for (const r of (data ?? [])) {
    const pos = (r.pre_orders ?? []) as ReservationPreOrder[];
    if (pos.length === 0) continue;
    const tableLabels = (r.reservation_tables ?? [])
      .map((rt: { tables?: { label?: string } }) => rt.tables?.label)
      .filter(Boolean) as string[];
    const g = r.guests as { first_name?: string | null; last_name?: string | null } | null;
    const guestName = [g?.first_name, g?.last_name].filter(Boolean).join(" ") || "Gast";
    for (const po of pos) {
      list.push({
        preOrder: po,
        reservationId: r.id,
        startTime: r.start_time as string,
        partySize: r.party_size as number,
        guestName,
        tableLabels,
        occasion: r.occasion as string | null,
      });
    }
  }
  return list.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// ---- hospitality suggestions ----

export type HospitalitySuggestion = {
  itemName: string;
  reason: string;
  category: string;
};

export function getHospitalitySuggestions(input: {
  partySize: number;
  occasion?: string | null;
  largeGroupThreshold?: number;
  isVip?: boolean;
}): HospitalitySuggestion[] {
  const out: HospitalitySuggestion[] = [];
  const threshold = input.largeGroupThreshold ?? 9;
  if (input.partySize >= threshold) {
    out.push({ itemName: "Borrelplank", reason: "Past goed bij een grote groep.", category: "Borrel" });
    out.push({ itemName: "Fles prosecco", reason: "Welkomstmoment voor de hele groep.", category: "Aperitief" });
  } else if (input.partySize >= 4) {
    out.push({ itemName: "Borrelplank", reason: "Leuk om te delen voor 4+ personen.", category: "Borrel" });
  }
  const occ = (input.occasion ?? "").toLowerCase();
  if (occ.includes("verjaardag")) {
    out.push({ itemName: "Verjaardagsdessert", reason: "Maak het feestelijk met een kaarsje.", category: "Verjaardag" });
    out.push({ itemName: "Prosecco per glas", reason: "Toost op de jarige.", category: "Aperitief" });
  }
  if (occ.includes("jubileum") || occ.includes("anniversary")) {
    out.push({ itemName: "Fles huiswijn wit", reason: "Past bij een rustige viering.", category: "Wijn" });
  }
  if (occ.includes("zakelijk") || occ.includes("business")) {
    out.push({ itemName: "Water op tafel", reason: "Direct service-klaar voor zakelijke gasten.", category: "Overig" });
  }
  if (input.isVip) {
    out.push({ itemName: "Welkomstdrankje", reason: "Persoonlijke ontvangst voor terugkerende gast.", category: "Aperitief" });
  }
  return out;
}
