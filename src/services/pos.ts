// POS-ready service layer — handles demo/manual receipts, matching, revenue previews,
// audit + integration events. No live POS calls.
import { supabase } from "@/integrations/supabase/client";

export type POSProvider =
  | "loyverse" | "loyverse_demo" | "manual_demo" | "manual"
  | "csv_import" | "webhook" | "lightspeed" | "untill" | "vectron"
  | "booq" | "twelve" | "mpluskassa" | "eijsink" | "winston" | "tebi"
  | "square" | "custom_api" | "other";

export type MatchingStatus = "unmatched" | "suggested" | "matched" | "ignored" | "conflict";
export type PaymentStatus = "paid" | "open" | "refunded" | "cancelled" | "unknown";
export type MatchScore = "high" | "medium" | "low";

export type POSReceipt = {
  id: string;
  restaurant_id: string;
  reservation_id: string | null;
  guest_id: string | null;
  table_id: string | null;
  external_table_id: string | null;
  external_order_id: string | null;
  provider: string;
  source_type: string;
  payment_status: string;
  matching_status: string;
  match_score: string | null;
  receipt_total: number; // euros (derived from total_cents)
  total_cents: number;
  tip_cents: number;
  subtotal_cents: number;
  tax_total_cents: number;
  discount_total_cents: number;
  guest_count: number | null;
  currency: string;
  receipt_created_at: string | null;
  imported_at: string | null;
  matched_at: string | null;
  opened_at: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
  created_at: string;
};

export type CreateReceiptInput = {
  restaurantId: string;
  reservationId?: string | null;
  provider?: POSProvider;
  sourceType?: "manual_demo" | "loyverse_demo" | "manual" | "csv_import";
  totalCents: number;
  tipCents?: number;
  taxCents?: number;
  guestCount?: number;
  paymentStatus?: PaymentStatus;
  receiptCreatedAt?: string;
  externalTableId?: string;
  externalOrderId?: string;
  metadata?: Record<string, unknown>;
};

export const POS_PROVIDERS: Array<{
  key: POSProvider; label: string; status: "Aanbevolen starter-POS" | "Demo-ready" | "Toekomstig" | "Voorbereid"; description: string;
}> = [
  { key: "loyverse",     label: "Loyverse POS",      status: "Aanbevolen starter-POS", description: "Gratis POS-basis voor kleine horeca. Geavanceerde Loyverse-functies kunnen betaalde add-ons vereisen." },
  { key: "lightspeed",   label: "Lightspeed",        status: "Toekomstig",   description: "Toekomstige API-koppeling — omzet per couvert." },
  { key: "untill",       label: "unTill",            status: "Toekomstig",   description: "Toekomstige koppeling voor middelgrote horeca." },
  { key: "vectron",      label: "Vectron",           status: "Toekomstig",   description: "Toekomstige koppeling." },
  { key: "booq",         label: "Booq",              status: "Toekomstig",   description: "Toekomstige koppeling." },
  { key: "twelve",       label: "Twelve",            status: "Toekomstig",   description: "Toekomstige koppeling." },
  { key: "mpluskassa",   label: "MplusKASSA",        status: "Toekomstig",   description: "Toekomstige koppeling." },
  { key: "eijsink",      label: "Eijsink",           status: "Toekomstig",   description: "Toekomstige koppeling." },
  { key: "winston",      label: "Winston",           status: "Toekomstig",   description: "Toekomstige koppeling." },
  { key: "tebi",         label: "Tebi",              status: "Toekomstig",   description: "Toekomstige koppeling." },
  { key: "square",       label: "Square",            status: "Toekomstig",   description: "Toekomstige koppeling." },
  { key: "custom_api",   label: "Anders / Custom API", status: "Voorbereid", description: "Custom POS via webhook of REST API." },
  { key: "csv_import",   label: "CSV-import",        status: "Voorbereid",   description: "Upload bonnen via CSV — handmatig matchen." },
  { key: "webhook",      label: "Webhook / middleware", status: "Voorbereid", description: "Events ontvangen via Make / Zapier / n8n." },
];

export const POS_FIELD_MAPPING: Array<{ pos: string; tablewise: string; note?: string }> = [
  { pos: "pos_provider",         tablewise: "pos_orders.provider" },
  { pos: "pos_location_id",      tablewise: "metadata.location_id" },
  { pos: "pos_store_id",         tablewise: "metadata.store_id" },
  { pos: "pos_terminal_id",      tablewise: "metadata.terminal_id" },
  { pos: "pos_table_id",         tablewise: "pos_orders.external_table_id" },
  { pos: "pos_order_id",         tablewise: "pos_orders.external_order_id" },
  { pos: "pos_receipt_id",       tablewise: "metadata.receipt_id" },
  { pos: "receipt_total",        tablewise: "pos_orders.total_cents" },
  { pos: "covers",               tablewise: "pos_orders.guest_count" },
  { pos: "revenue_per_guest",    tablewise: "afgeleid", note: "Berekend op basis van total / covers" },
  { pos: "payment_status",       tablewise: "pos_orders.payment_status" },
  { pos: "receipt_created_at",   tablewise: "pos_orders.receipt_created_at" },
  { pos: "pos_customer_id",      tablewise: "metadata.customer_id", note: "Optioneel — gastkoppeling later" },
];

export const POS_INTEGRATION_EVENTS = [
  "pos.connection_prepared", "pos.mapping_updated", "pos.demo_receipt_created",
  "pos.manual_receipt_created", "pos.receipt_imported", "pos.receipt_matched",
  "pos.receipt_unmatched", "pos.receipt_ignored", "pos.sync_failed", "pos.provider_selected",
];

function centsToEuro(c: number) { return Math.round(c) / 100; }

function toReceipt(row: Record<string, unknown>): POSReceipt {
  const r = row as { [k: string]: unknown };
  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    reservation_id: (r.reservation_id as string) ?? null,
    guest_id: (r.guest_id as string) ?? null,
    table_id: (r.table_id as string) ?? null,
    external_table_id: (r.external_table_id as string) ?? null,
    external_order_id: (r.external_order_id as string) ?? null,
    provider: (r.provider as string) ?? "manual_demo",
    source_type: (r.source_type as string) ?? "manual_demo",
    payment_status: (r.payment_status as string) ?? "unknown",
    matching_status: (r.matching_status as string) ?? "unmatched",
    match_score: (r.match_score as string) ?? null,
    total_cents: (r.total_cents as number) ?? 0,
    receipt_total: centsToEuro((r.total_cents as number) ?? 0),
    tip_cents: (r.tip_cents as number) ?? 0,
    subtotal_cents: (r.subtotal_cents as number) ?? 0,
    tax_total_cents: (r.tax_total_cents as number) ?? 0,
    discount_total_cents: (r.discount_total_cents as number) ?? 0,
    guest_count: (r.guest_count as number) ?? null,
    currency: (r.currency as string) ?? "EUR",
    receipt_created_at: (r.receipt_created_at as string) ?? null,
    imported_at: (r.imported_at as string) ?? null,
    matched_at: (r.matched_at as string) ?? null,
    opened_at: (r.opened_at as string) ?? null,
    closed_at: (r.closed_at as string) ?? null,
    metadata: ((r.metadata as Record<string, unknown>) ?? {}),
    raw_payload: ((r.raw_payload as Record<string, unknown>) ?? {}),
    created_at: r.created_at as string,
  };
}

async function logIntegrationEvent(restaurantId: string, eventType: string, payload: Record<string, unknown>) {
  try {
    await (supabase as unknown as { from: (t: string) => { insert: (v: unknown) => Promise<unknown> } })
      .from("integration_events")
      .insert({ restaurant_id: restaurantId, event_type: eventType, target: "pos", payload, status: "pending" });
  } catch { /* non-blocking */ }
}

async function logAudit(restaurantId: string, action: string, entityId: string | null, after: Record<string, unknown>) {
  try {
    await (supabase as unknown as { from: (t: string) => { insert: (v: unknown) => Promise<unknown> } })
      .from("audit_log")
      .insert({ restaurant_id: restaurantId, entity: "pos_orders", entity_id: entityId, action, after_data: after });
  } catch { /* non-blocking */ }
}

export async function createDemoPOSReceipt(input: CreateReceiptInput): Promise<POSReceipt> {
  return createReceiptInternal({ ...input, provider: input.provider ?? "loyverse_demo", sourceType: input.sourceType ?? "loyverse_demo" as never });
}

export async function createManualPOSReceipt(input: CreateReceiptInput): Promise<POSReceipt> {
  return createReceiptInternal({ ...input, provider: input.provider ?? "manual_demo", sourceType: input.sourceType ?? "manual_demo" });
}

async function createReceiptInternal(input: CreateReceiptInput): Promise<POSReceipt> {
  const now = new Date().toISOString();
  const row = {
    restaurant_id: input.restaurantId,
    reservation_id: input.reservationId ?? null,
    provider: input.provider ?? "manual_demo",
    source_type: input.sourceType ?? "manual_demo",
    total_cents: Math.round(input.totalCents),
    subtotal_cents: Math.round(input.totalCents - (input.taxCents ?? 0)),
    tax_total_cents: Math.round(input.taxCents ?? 0),
    tip_cents: Math.round(input.tipCents ?? 0),
    guest_count: input.guestCount ?? null,
    payment_status: input.paymentStatus ?? "paid",
    receipt_created_at: input.receiptCreatedAt ?? now,
    imported_at: now,
    matching_status: input.reservationId ? "matched" : "unmatched",
    matched_at: input.reservationId ? now : null,
    external_table_id: input.externalTableId ?? null,
    external_order_id: input.externalOrderId ?? null,
    currency: "EUR",
    metadata: input.metadata ?? {},
    raw_payload: { source: "manual_demo_form", created_via: "tablewise_ui" },
  };
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => { insert: (v: unknown) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } } };
  }).from("pos_orders").insert(row).select().single();
  if (error) throw error;
  const receipt = toReceipt(data as Record<string, unknown>);
  await logIntegrationEvent(input.restaurantId,
    input.sourceType === "loyverse_demo" || input.provider === "loyverse_demo" ? "pos.demo_receipt_created" : "pos.manual_receipt_created",
    { receipt_id: receipt.id, total_cents: receipt.total_cents, reservation_id: receipt.reservation_id });
  await logAudit(input.restaurantId, "pos.demo_receipt.created", receipt.id, row);
  return receipt;
}

export async function listPOSReceipts(restaurantId: string, filter?: { matchingStatus?: MatchingStatus; provider?: string }): Promise<POSReceipt[]> {
  let q = (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => unknown } };
  }).from("pos_orders").select("*").eq("restaurant_id", restaurantId) as unknown as {
    eq: (c: string, v: unknown) => typeof q;
    order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown[]; error: unknown }>;
  };
  if (filter?.matchingStatus) q = q.eq("matching_status", filter.matchingStatus);
  if (filter?.provider) q = q.eq("provider", filter.provider);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(toReceipt);
}

export async function listReceiptsForReservation(reservationId: string): Promise<POSReceipt[]> {
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown[]; error: unknown }> } } };
  }).from("pos_orders").select("*").eq("reservation_id", reservationId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(toReceipt);
}

export async function listReceiptsForGuest(restaurantId: string, guestId: string): Promise<POSReceipt[]> {
  // Match either by direct guest_id or via reservations.guest_id
  const { data: direct } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => Promise<{ data: unknown[] }> } } };
  }).from("pos_orders").select("*").eq("restaurant_id", restaurantId).eq("guest_id", guestId);

  const { data: viaRes } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => Promise<{ data: { id: string }[] }> } };
  }).from("reservations").select("id").eq("guest_id", guestId);
  const ids = (viaRes ?? []).map((r) => r.id);
  let viaResReceipts: unknown[] = [];
  if (ids.length) {
    const { data } = await (supabase as unknown as {
      from: (t: string) => { select: (s: string) => { in: (c: string, v: unknown[]) => Promise<{ data: unknown[] }> } };
    }).from("pos_orders").select("*").in("reservation_id", ids);
    viaResReceipts = data ?? [];
  }
  const merged = new Map<string, Record<string, unknown>>();
  [...(direct ?? []), ...viaResReceipts].forEach((r) => merged.set((r as { id: string }).id, r as Record<string, unknown>));
  return Array.from(merged.values()).map(toReceipt);
}

export async function suggestReservationMatches(receipt: POSReceipt): Promise<Array<{ reservationId: string; score: MatchScore; reason: string; party_size: number; start_time: string; date: string; }>> {
  if (!receipt.receipt_created_at) return [];
  const date = receipt.receipt_created_at.slice(0, 10);
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => Promise<{ data: Array<{ id: string; party_size: number; start_time: string; end_time: string; reservation_date: string }> }> } } };
  }).from("reservations").select("id,party_size,start_time,end_time,reservation_date").eq("restaurant_id", receipt.restaurant_id).eq("reservation_date", date);
  const reservations = data ?? [];
  const t = new Date(receipt.receipt_created_at).getTime();
  return reservations.map((r) => {
    const start = new Date(r.start_time).getTime();
    const end = new Date(r.end_time).getTime();
    const inSlot = t >= start - 30 * 60_000 && t <= end + 60 * 60_000;
    const coversMatch = receipt.guest_count != null && Math.abs(r.party_size - (receipt.guest_count ?? 0)) <= 1;
    let score: MatchScore = "low";
    let reason = "Zelfde datum";
    if (inSlot && coversMatch) { score = "high"; reason = "Tijd binnen reservering en couverts kloppen"; }
    else if (inSlot) { score = "medium"; reason = "Tijd binnen reserveringsperiode"; }
    else if (coversMatch) { score = "medium"; reason = "Aantal couverts komt overeen"; }
    return { reservationId: r.id, score, reason, party_size: r.party_size, start_time: r.start_time, date: r.reservation_date };
  }).sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.score] - { high: 3, medium: 2, low: 1 }[a.score]));
}

export async function matchReceiptToReservation(receipt: POSReceipt, reservationId: string): Promise<void> {
  const { error } = await (supabase as unknown as {
    from: (t: string) => { update: (v: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> } };
  }).from("pos_orders").update({ reservation_id: reservationId, matching_status: "matched", matched_at: new Date().toISOString() }).eq("id", receipt.id);
  if (error) throw error;
  await logIntegrationEvent(receipt.restaurant_id, "pos.receipt_matched", { receipt_id: receipt.id, reservation_id: reservationId });
  await logAudit(receipt.restaurant_id, "pos.receipt.matched", receipt.id, { reservation_id: reservationId });
}

export async function unmatchReceipt(receipt: POSReceipt): Promise<void> {
  const { error } = await (supabase as unknown as {
    from: (t: string) => { update: (v: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> } };
  }).from("pos_orders").update({ reservation_id: null, matching_status: "unmatched", matched_at: null }).eq("id", receipt.id);
  if (error) throw error;
  await logIntegrationEvent(receipt.restaurant_id, "pos.receipt_unmatched", { receipt_id: receipt.id });
  await logAudit(receipt.restaurant_id, "pos.receipt.unmatched", receipt.id, {});
}

export async function ignoreReceipt(receipt: POSReceipt): Promise<void> {
  const { error } = await (supabase as unknown as {
    from: (t: string) => { update: (v: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> } };
  }).from("pos_orders").update({ matching_status: "ignored" }).eq("id", receipt.id);
  if (error) throw error;
  await logIntegrationEvent(receipt.restaurant_id, "pos.receipt_ignored", { receipt_id: receipt.id });
  await logAudit(receipt.restaurant_id, "pos.receipt.ignored", receipt.id, {});
}

export type RevenuePreview = {
  todayCents: number;
  matchedCount: number;
  unmatchedCount: number;
  ignoredCount: number;
  avgPerCover: number;
  perChannel: Array<{ channel: string; cents: number; count: number }>;
};

export async function getRevenuePreview(restaurantId: string): Promise<RevenuePreview> {
  const receipts = await listPOSReceipts(restaurantId);
  const today = new Date().toISOString().slice(0, 10);
  const todayReceipts = receipts.filter((r) => (r.receipt_created_at ?? r.created_at).slice(0, 10) === today);
  const matched = receipts.filter((r) => r.matching_status === "matched");
  const totalCovers = matched.reduce((s, r) => s + (r.guest_count ?? 0), 0);
  const totalCents = matched.reduce((s, r) => s + r.total_cents, 0);

  const resIds = matched.map((r) => r.reservation_id).filter(Boolean) as string[];
  const channelMap = new Map<string, { cents: number; count: number }>();
  if (resIds.length) {
    const { data } = await (supabase as unknown as {
      from: (t: string) => { select: (s: string) => { in: (c: string, v: unknown[]) => Promise<{ data: Array<{ id: string; channel: string }> }> } };
    }).from("reservations").select("id,channel").in("id", resIds);
    const map = new Map((data ?? []).map((r) => [r.id, r.channel]));
    matched.forEach((r) => {
      const ch = (r.reservation_id && map.get(r.reservation_id)) || "onbekend";
      const cur = channelMap.get(ch) ?? { cents: 0, count: 0 };
      channelMap.set(ch, { cents: cur.cents + r.total_cents, count: cur.count + 1 });
    });
  }

  return {
    todayCents: todayReceipts.reduce((s, r) => s + r.total_cents, 0),
    matchedCount: matched.length,
    unmatchedCount: receipts.filter((r) => r.matching_status === "unmatched").length,
    ignoredCount: receipts.filter((r) => r.matching_status === "ignored").length,
    avgPerCover: totalCovers > 0 ? Math.round(totalCents / totalCovers) : 0,
    perChannel: Array.from(channelMap.entries()).map(([channel, v]) => ({ channel, ...v })),
  };
}

export async function listPOSEvents(restaurantId: string): Promise<Array<{ id: string; event_type: string; status: string; created_at: string; payload: Record<string, unknown> }>> {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: unknown[] }> } } } } };
  }).from("integration_events").select("id,event_type,status,created_at,payload").eq("restaurant_id", restaurantId).eq("target", "pos").order("created_at", { ascending: false }).limit(50);
  return (data as Array<{ id: string; event_type: string; status: string; created_at: string; payload: Record<string, unknown> }>) ?? [];
}

export async function selectProvider(restaurantId: string, provider: POSProvider): Promise<void> {
  // Persist the selected POS provider on the restaurant so the choice survives reloads.
  const { data: row, error: readErr } = await supabase
    .from("restaurants")
    .select("metadata")
    .eq("id", restaurantId)
    .maybeSingle();
  if (readErr) throw readErr;
  const currentMeta = ((row?.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const integrations = ((currentMeta.integrations as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const nextMeta = {
    ...currentMeta,
    integrations: {
      ...integrations,
      pos_provider: provider,
      pos_provider_selected_at: new Date().toISOString(),
    },
  };
  const { error: writeErr } = await supabase
    .from("restaurants")
    .update({ metadata: nextMeta })
    .eq("id", restaurantId);
  if (writeErr) throw writeErr;
  await logIntegrationEvent(restaurantId, "pos.provider_selected", { provider });
  await logAudit(restaurantId, "pos.provider.selected", null, { provider });
}

export async function getSelectedProvider(restaurantId: string): Promise<POSProvider | null> {
  const { data } = await supabase
    .from("restaurants")
    .select("metadata")
    .eq("id", restaurantId)
    .maybeSingle();
  const meta = (data?.metadata ?? {}) as { integrations?: { pos_provider?: string } };
  return (meta.integrations?.pos_provider as POSProvider | undefined) ?? null;
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

// ---- Loyverse OAuth client helpers ----
export type LoyverseConnectionStatus = {
  id: string;
  status: string;
  display_name: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  token_expires_at: string | null;
  external_account_id: string | null;
  created_at: string;
} | null;

async function invokeLoyverse(action: string, body?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("loyverse_connect", {
    method: "POST",
    body: { action, ...(body ?? {}) },
  });
  if (error) throw error;
  if (data && typeof data === "object" && (data as Record<string, unknown>).error) {
    const msg = (data as Record<string, unknown>).message as string | undefined;
    throw new Error(msg ?? String((data as Record<string, unknown>).error));
  }
  return data as Record<string, unknown>;
}

export type LoyverseConnectResult = {
  connection: LoyverseConnectionStatus;
  imported_items: number;
  imported_receipts: number;
  sync_error: string | null;
};

export async function connectLoyverseWithToken(
  restaurantId: string,
  accessToken: string,
): Promise<LoyverseConnectResult> {
  const r = await invokeLoyverse("connect", { restaurant_id: restaurantId, access_token: accessToken });
  return {
    connection: (r.connection as LoyverseConnectionStatus) ?? null,
    imported_items: (r.imported_items as number) ?? 0,
    imported_receipts: (r.imported_receipts as number) ?? 0,
    sync_error: (r.sync_error as string | null) ?? null,
  };
}

export async function getLoyverseStatus(restaurantId: string): Promise<LoyverseConnectionStatus> {
  const r = await invokeLoyverse("status", { restaurant_id: restaurantId });
  return (r.connection as LoyverseConnectionStatus) ?? null;
}

export async function syncLoyverseNow(restaurantId: string): Promise<{ imported_items: number; imported_receipts: number; skipped: number }> {
  const r = await invokeLoyverse("sync_now", { restaurant_id: restaurantId });
  return {
    imported_items: (r.imported_items as number) ?? 0,
    imported_receipts: (r.imported_receipts as number) ?? 0,
    skipped: (r.skipped as number) ?? 0,
  };
}

export async function countLoyverseItems(restaurantId: string): Promise<number> {
  const { count } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string, opts: { count: string; head: boolean }) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => Promise<{ count: number | null }> } } } };
  }).from("pre_order_items")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("pos_provider", "loyverse")
    .eq("is_active", true);
  return count ?? 0;
}

export async function disconnectLoyverse(restaurantId: string): Promise<void> {
  await invokeLoyverse("disconnect", { restaurant_id: restaurantId });
}

// ---- Loyverse pre-order push config ----
export type PreorderPushConfig = {
  enabled: boolean;
  minutes_before: number;
  dining_option_id: string | null;
  store_id: string | null;
};

const DEFAULT_PUSH_CONFIG: PreorderPushConfig = {
  enabled: false,
  minutes_before: 30,
  dining_option_id: null,
  store_id: null,
};

export async function getPreorderPushConfig(restaurantId: string): Promise<PreorderPushConfig> {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { maybeSingle: () => Promise<{ data: { config: Record<string, unknown> } | null }> } } } };
  }).from("pos_connections").select("config").eq("restaurant_id", restaurantId).eq("provider", "loyverse").maybeSingle();
  const cfg = ((data?.config as Record<string, unknown>)?.push_preorders ?? {}) as Partial<PreorderPushConfig>;
  return { ...DEFAULT_PUSH_CONFIG, ...cfg };
}

export async function updatePreorderPushConfig(restaurantId: string, patch: Partial<PreorderPushConfig>): Promise<PreorderPushConfig> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { maybeSingle: () => Promise<{ data: { id: string; config: Record<string, unknown> } | null }> } } };
      update: (v: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> };
    };
  };
  const { data } = await sb.from("pos_connections")
    .select("id,config").eq("restaurant_id", restaurantId).eq("provider", "loyverse").maybeSingle();
  if (!data) throw new Error("Loyverse niet gekoppeld");
  const current = ((data.config as Record<string, unknown>)?.push_preorders ?? {}) as Partial<PreorderPushConfig>;
  const next: PreorderPushConfig = { ...DEFAULT_PUSH_CONFIG, ...current, ...patch };
  const newConfig = { ...(data.config ?? {}), push_preorders: next };
  const { error } = await sb.from("pos_connections").update({ config: newConfig }).eq("id", data.id);
  if (error) throw error as Error;
  return next;
}

export async function pushPreorderToLoyverse(reservationId: string): Promise<{ ok: boolean; receipt_id?: string; error?: string; skipped?: string }> {
  const { data, error } = await supabase.functions.invoke("loyverse_push_preorder", {
    method: "POST",
    body: { mode: "manual", reservation_id: reservationId },
  });
  if (error) throw error;
  return data as { ok: boolean; receipt_id?: string; error?: string; skipped?: string };
}

