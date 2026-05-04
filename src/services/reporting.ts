// Reporting service — central metrics for the Rapportages page.
// Houdt berekeningen centraal, voorkomt deling door 0, geeft veilige fallbacks.
import { supabase } from "@/integrations/supabase/client";

export type DateRange = { from: string; to: string }; // YYYY-MM-DD inclusive

export type RangePreset = "today" | "yesterday" | "week" | "last_week" | "month" | "custom";

function isoDate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function getReportingDateRange(preset: RangePreset, custom?: DateRange): DateRange {
  const now = new Date();
  const today = isoDate(now);
  const startOfWeek = new Date(now);
  const day = (now.getDay() + 6) % 7; // Monday = 0
  startOfWeek.setDate(now.getDate() - day);

  switch (preset) {
    case "today":     return { from: today, to: today };
    case "yesterday": { const y = new Date(now); y.setDate(now.getDate() - 1); return { from: isoDate(y), to: isoDate(y) }; }
    case "week":      return { from: isoDate(startOfWeek), to: today };
    case "last_week": { const s = new Date(startOfWeek); s.setDate(s.getDate() - 7); const e = new Date(s); e.setDate(s.getDate() + 6); return { from: isoDate(s), to: isoDate(e) }; }
    case "month":     return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "custom":    return custom ?? { from: today, to: today };
  }
}

export function isValidRange(r: DateRange): boolean {
  return !!r.from && !!r.to && r.from <= r.to;
}

const safePct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

// ---------- Reservations & covers ----------
export type ReservationMetrics = {
  total: number;
  byStatus: Record<string, number>;
  covers: number;
  averagePartySize: number;
  perDay: Array<{ date: string; reservations: number; covers: number }>;
};

export async function getReservationMetrics(restaurantId: string, range: DateRange): Promise<ReservationMetrics> {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ status: string; party_size: number; reservation_date: string }> }> } } } };
  }).from("reservations").select("status,party_size,reservation_date").eq("restaurant_id", restaurantId).gte("reservation_date", range.from).lte("reservation_date", range.to);
  const rows = data ?? [];

  const byStatus: Record<string, number> = {};
  let covers = 0;
  const dayMap = new Map<string, { reservations: number; covers: number }>();
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (!["cancelled", "no_show", "hold"].includes(r.status)) covers += r.party_size;
    const cur = dayMap.get(r.reservation_date) ?? { reservations: 0, covers: 0 };
    cur.reservations += 1;
    if (!["cancelled", "no_show", "hold"].includes(r.status)) cur.covers += r.party_size;
    dayMap.set(r.reservation_date, cur);
  }
  const counted = rows.filter((r) => !["cancelled", "no_show", "hold"].includes(r.status));
  return {
    total: rows.length,
    byStatus,
    covers,
    averagePartySize: counted.length > 0 ? Math.round((covers / counted.length) * 10) / 10 : 0,
    perDay: Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ---------- Channel metrics ----------
export type ChannelRow = { channel: string; reservations: number; covers: number; noShows: number; cancelled: number; completed: number; avgPartySize: number; noShowPct: number };

export async function getChannelMetrics(restaurantId: string, range: DateRange): Promise<ChannelRow[]> {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ channel: string; status: string; party_size: number }> }> } } } };
  }).from("reservations").select("channel,status,party_size").eq("restaurant_id", restaurantId).gte("reservation_date", range.from).lte("reservation_date", range.to);
  const map = new Map<string, ChannelRow>();
  for (const r of data ?? []) {
    const ch = r.channel ?? "onbekend";
    const row = map.get(ch) ?? { channel: ch, reservations: 0, covers: 0, noShows: 0, cancelled: 0, completed: 0, avgPartySize: 0, noShowPct: 0 };
    row.reservations += 1;
    row.covers += r.party_size;
    if (r.status === "no_show") row.noShows += 1;
    if (r.status === "cancelled") row.cancelled += 1;
    if (["completed", "seated"].includes(r.status)) row.completed += 1;
    map.set(ch, row);
  }
  return Array.from(map.values()).map((r) => ({
    ...r,
    avgPartySize: r.reservations > 0 ? Math.round((r.covers / r.reservations) * 10) / 10 : 0,
    noShowPct: safePct(r.noShows, r.reservations),
  })).sort((a, b) => b.reservations - a.reservations);
}

// ---------- No-show metrics ----------
export type NoShowMetrics = {
  noShows: number;
  cancelled: number;
  total: number;
  noShowPct: number;
  reconfirmationOpen: number;
  reconfirmationConfirmed: number;
  largeGroupNoShows: number;
};

export async function getNoShowMetrics(restaurantId: string, range: DateRange, largeGroupThreshold = 9): Promise<NoShowMetrics> {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ status: string; party_size: number; reconfirmation_status: string | null }> }> } } } };
  }).from("reservations").select("status,party_size,reconfirmation_status").eq("restaurant_id", restaurantId).gte("reservation_date", range.from).lte("reservation_date", range.to);
  const rows = data ?? [];
  const noShows = rows.filter((r) => r.status === "no_show").length;
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  return {
    total: rows.length,
    noShows,
    cancelled,
    noShowPct: safePct(noShows, rows.length),
    reconfirmationOpen: rows.filter((r) => r.reconfirmation_status === "requested").length,
    reconfirmationConfirmed: rows.filter((r) => r.reconfirmation_status === "confirmed").length,
    largeGroupNoShows: rows.filter((r) => r.status === "no_show" && r.party_size >= largeGroupThreshold).length,
  };
}

// ---------- Waitlist metrics ----------
export type WaitlistMetrics = {
  active: number;
  matched: number;
  notified: number;
  converted: number;
  expired: number;
  conversionPct: number;
  avgPartySize: number;
};

export async function getWaitlistMetrics(restaurantId: string, range: DateRange): Promise<WaitlistMetrics> {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ status: string; party_size: number }> }> } } } };
  }).from("waitlist_entries").select("status,party_size").eq("restaurant_id", restaurantId).gte("desired_date", range.from).lte("desired_date", range.to);
  const rows = data ?? [];
  const counts = (s: string) => rows.filter((r) => r.status === s).length;
  const converted = counts("converted") + counts("confirmed");
  const totalRelevant = rows.length;
  return {
    active: counts("waiting") + counts("matched") + counts("notified"),
    matched: counts("matched"),
    notified: counts("notified"),
    converted,
    expired: counts("expired") + counts("cancelled"),
    conversionPct: safePct(converted, totalRelevant),
    avgPartySize: totalRelevant > 0 ? Math.round((rows.reduce((s, r) => s + r.party_size, 0) / totalRelevant) * 10) / 10 : 0,
  };
}

// ---------- Walk-in metrics ----------
export async function getWalkInMetrics(restaurantId: string, range: DateRange) {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ party_size: number; reservation_date: string }> }> } } } } };
  }).from("reservations").select("party_size,reservation_date").eq("restaurant_id", restaurantId).eq("channel", "walk_in").gte("reservation_date", range.from).lte("reservation_date", range.to);
  const rows = data ?? [];
  const perDay = new Map<string, number>();
  rows.forEach((r) => perDay.set(r.reservation_date, (perDay.get(r.reservation_date) ?? 0) + 1));
  return {
    total: rows.length,
    covers: rows.reduce((s, r) => s + r.party_size, 0),
    avgPartySize: rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.party_size, 0) / rows.length) * 10) / 10 : 0,
    perDay: Array.from(perDay.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ---------- Large groups ----------
export async function getLargeGroupMetrics(restaurantId: string, range: DateRange, threshold = 9) {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => { gte: (c: string, v: unknown) => Promise<{ data: Array<{ status: string; party_size: number; large_group_status: string | null }> }> } } } } };
  }).from("reservations").select("status,party_size,large_group_status").eq("restaurant_id", restaurantId).gte("reservation_date", range.from).lte("reservation_date", range.to).gte("party_size", threshold);
  const rows = data ?? [];
  return {
    total: rows.length,
    covers: rows.reduce((s, r) => s + r.party_size, 0),
    avgPartySize: rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.party_size, 0) / rows.length) * 10) / 10 : 0,
    awaitingApproval: rows.filter((r) => r.large_group_status === "awaiting_approval").length,
    approved: rows.filter((r) => r.large_group_status === "approved").length,
    declined: rows.filter((r) => r.large_group_status === "declined").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    noShows: rows.filter((r) => r.status === "no_show").length,
  };
}

// ---------- Pre-orders ----------
export async function getPreOrderMetrics(restaurantId: string, range: DateRange) {
  // join via reservation date filter
  const { data: resRows } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ id: string }> }> } } } };
  }).from("reservations").select("id").eq("restaurant_id", restaurantId).gte("reservation_date", range.from).lte("reservation_date", range.to);
  const ids = (resRows ?? []).map((r) => r.id);
  if (ids.length === 0) return { total: 0, byStatus: {}, topItems: [], estimatedRevenueCents: 0 };
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { in: (c: string, v: unknown[]) => Promise<{ data: Array<{ status: string; quantity: number; unit_price_cents: number; item_name: string }> }> } };
  }).from("pre_orders").select("status,quantity,unit_price_cents,item_name").in("reservation_id", ids);
  const rows = data ?? [];
  const byStatus: Record<string, number> = {};
  const itemMap = new Map<string, number>();
  let revenueCents = 0;
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    itemMap.set(r.item_name, (itemMap.get(r.item_name) ?? 0) + r.quantity);
    revenueCents += (r.unit_price_cents ?? 0) * r.quantity;
  }
  return {
    total: rows.length,
    byStatus,
    estimatedRevenueCents: revenueCents,
    topItems: Array.from(itemMap.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5),
  };
}

// ---------- Reviews ----------
export async function getReviewMetrics(restaurantId: string, range: DateRange) {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ status: string; satisfaction: number | null; manager_follow_up_required: boolean | null; google_review_requested: boolean | null }> }> } } } };
  }).from("review_requests").select("status,satisfaction,manager_follow_up_required,google_review_requested").eq("restaurant_id", restaurantId).gte("scheduled_for", range.from).lte("scheduled_for", `${range.to}T23:59:59`);
  const rows = data ?? [];
  const responded = rows.filter((r) => r.satisfaction != null);
  const avg = responded.length > 0 ? Math.round((responded.reduce((s, r) => s + (r.satisfaction ?? 0), 0) / responded.length) * 10) / 10 : 0;
  return {
    requestsReady: rows.filter((r) => r.status === "ready_to_send" || r.status === "pending").length,
    responses: responded.length,
    positive: rows.filter((r) => r.status === "positive" || (r.satisfaction ?? 0) >= 4).length,
    neutral: rows.filter((r) => r.status === "neutral" || (r.satisfaction === 3)).length,
    negative: rows.filter((r) => r.status === "negative" || ((r.satisfaction ?? 0) > 0 && (r.satisfaction ?? 0) <= 2)).length,
    followUpRequired: rows.filter((r) => r.manager_follow_up_required).length,
    googleInvited: rows.filter((r) => r.google_review_requested).length,
    averageSatisfaction: avg,
  };
}

// ---------- Guests ----------
export async function getGuestMetrics(restaurantId: string, range: DateRange) {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => Promise<{ data: Array<{ visit_count: number; is_vip: boolean; allergies: string | null; marketing_consent: boolean; created_at: string }> }> } } };
  }).from("guests").select("visit_count,is_vip,allergies,marketing_consent,created_at").eq("restaurant_id", restaurantId).gte("created_at", `${range.from}T00:00:00`);
  const rows = data ?? [];
  return {
    newGuests: rows.length,
    returning: rows.filter((r) => r.visit_count > 1).length,
    vip: rows.filter((r) => r.is_vip).length,
    withAllergies: rows.filter((r) => r.allergies && r.allergies.trim().length > 0).length,
    marketingOptIn: rows.filter((r) => r.marketing_consent).length,
  };
}

// ---------- POS revenue ----------
export type POSRevenueMetrics = {
  totalCents: number;
  matchedCount: number;
  unmatchedCount: number;
  avgPerCoverCents: number;
  avgPerReservationCents: number;
  perChannel: Array<{ channel: string; cents: number; count: number }>;
  perShift: Array<{ shift: string; cents: number; count: number }>;
  walkInRevenueCents: number;
  largeGroupRevenueCents: number;
  hasData: boolean;
};

export async function getPOSRevenueMetrics(restaurantId: string, range: DateRange, largeGroupThreshold = 9): Promise<POSRevenueMetrics> {
  const fromIso = `${range.from}T00:00:00`;
  const toIso = `${range.to}T23:59:59`;
  const { data: receiptsRaw } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ id: string; reservation_id: string | null; total_cents: number; guest_count: number | null; matching_status: string }> }> } } } };
  }).from("pos_orders").select("id,reservation_id,total_cents,guest_count,matching_status,created_at").eq("restaurant_id", restaurantId).gte("created_at", fromIso).lte("created_at", toIso);
  const receipts = receiptsRaw ?? [];
  const matched = receipts.filter((r) => r.matching_status === "matched");
  const totalCents = matched.reduce((s, r) => s + (r.total_cents ?? 0), 0);
  const totalCovers = matched.reduce((s, r) => s + (r.guest_count ?? 0), 0);

  // Per channel + walk-in + large group via reservations join
  const resIds = matched.map((r) => r.reservation_id).filter(Boolean) as string[];
  const channelMap = new Map<string, { cents: number; count: number }>();
  let walkInRevenueCents = 0;
  let largeGroupRevenueCents = 0;

  if (resIds.length > 0) {
    const { data: resData } = await (supabase as unknown as {
      from: (t: string) => { select: (s: string) => { in: (c: string, v: unknown[]) => Promise<{ data: Array<{ id: string; channel: string; party_size: number }> }> } };
    }).from("reservations").select("id,channel,party_size").in("id", resIds);
    const resMap = new Map((resData ?? []).map((r) => [r.id, r]));
    for (const rec of matched) {
      const r = rec.reservation_id ? resMap.get(rec.reservation_id) : null;
      const ch = r?.channel ?? "onbekend";
      const cur = channelMap.get(ch) ?? { cents: 0, count: 0 };
      cur.cents += rec.total_cents ?? 0;
      cur.count += 1;
      channelMap.set(ch, cur);
      if (r?.channel === "walk_in") walkInRevenueCents += rec.total_cents ?? 0;
      if ((r?.party_size ?? 0) >= largeGroupThreshold) largeGroupRevenueCents += rec.total_cents ?? 0;
    }
  }

  return {
    totalCents,
    matchedCount: matched.length,
    unmatchedCount: receipts.filter((r) => r.matching_status === "unmatched").length,
    avgPerCoverCents: totalCovers > 0 ? Math.round(totalCents / totalCovers) : 0,
    avgPerReservationCents: matched.length > 0 ? Math.round(totalCents / matched.length) : 0,
    perChannel: Array.from(channelMap.entries()).map(([channel, v]) => ({ channel, ...v })).sort((a, b) => b.cents - a.cents),
    perShift: [], // shift mapping niet direct beschikbaar — voorbereid
    walkInRevenueCents,
    largeGroupRevenueCents,
    hasData: receipts.length > 0,
  };
}

// ---------- Pacing ----------
export async function getPacingMetrics(restaurantId: string, range: DateRange) {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ start_time: string; party_size: number; status: string }> }> } } } };
  }).from("reservations").select("start_time,party_size,status").eq("restaurant_id", restaurantId).gte("reservation_date", range.from).lte("reservation_date", range.to);
  const rows = data ?? [];
  const slotMap = new Map<string, { covers: number; reservations: number; noShows: number }>();
  for (const r of rows) {
    if (!r.start_time) continue;
    const d = new Date(r.start_time);
    const slot = `${String(d.getHours()).padStart(2, "0")}:${d.getMinutes() >= 30 ? "30" : "00"}`;
    const cur = slotMap.get(slot) ?? { covers: 0, reservations: 0, noShows: 0 };
    cur.reservations += 1;
    if (!["cancelled", "no_show", "hold"].includes(r.status)) cur.covers += r.party_size;
    if (r.status === "no_show") cur.noShows += 1;
    slotMap.set(slot, cur);
  }
  return Array.from(slotMap.entries()).map(([slot, v]) => ({ slot, ...v })).sort((a, b) => a.slot.localeCompare(b.slot));
}

// ---------- Insight cards ----------
export type InsightCard = { id: string; title: string; body: string; tone: "info" | "positive" | "warning" };

export function buildInsightCards(args: {
  channel: ChannelRow[];
  noShow: NoShowMetrics;
  waitlist: WaitlistMetrics;
  walkIn: { total: number };
  largeGroup: { total: number; awaitingApproval: number };
  pacing: Array<{ slot: string; covers: number; reservations: number }>;
}): InsightCard[] {
  const out: InsightCard[] = [];
  // Best performing channel
  const topChannel = [...args.channel].sort((a, b) => b.reservations - a.reservations)[0];
  if (topChannel && topChannel.reservations >= 3) {
    out.push({ id: "top-channel", tone: "info",
      title: `${topChannel.channel} levert de meeste reserveringen`,
      body: `${topChannel.reservations} reserveringen · ${topChannel.covers} couverts in deze periode.` });
  }
  // No-show channel
  const worst = [...args.channel].filter((c) => c.reservations >= 5).sort((a, b) => b.noShowPct - a.noShowPct)[0];
  if (worst && worst.noShowPct >= 10) {
    out.push({ id: "noshow-channel", tone: "warning",
      title: `Hoog no-show percentage bij ${worst.channel}`,
      body: `${worst.noShowPct}% van de reserveringen via dit kanaal kwam niet opdagen.` });
  }
  // Waitlist conversion
  if (args.waitlist.converted > 0) {
    out.push({ id: "waitlist-saved", tone: "positive",
      title: `Wachtlijst vulde ${args.waitlist.converted} reserveringen opnieuw`,
      body: `${args.waitlist.conversionPct}% conversie deze periode.` });
  }
  // Busiest slot
  const busiest = [...args.pacing].sort((a, b) => b.covers - a.covers)[0];
  if (busiest && busiest.covers >= 6) {
    out.push({ id: "busiest", tone: "info",
      title: `${busiest.slot} is structureel druk`,
      body: `${busiest.covers} couverts · ${busiest.reservations} reserveringen op dit slot.` });
  }
  // Walk-ins note
  if (args.walkIn.total >= 3) {
    out.push({ id: "walkins", tone: "info",
      title: `${args.walkIn.total} walk-ins in deze periode`,
      body: "Houd hier rekening mee bij het vrijhouden van tafels." });
  }
  // Large group approval pending
  if (args.largeGroup.awaitingApproval > 0) {
    out.push({ id: "lg-approval", tone: "warning",
      title: `${args.largeGroup.awaitingApproval} grote groep(en) wachten op goedkeuring`,
      body: "Volg deze aanvragen op om gemiste covers te voorkomen." });
  }
  return out;
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

// ---------- Hourly occupancy ----------
export type HourlyOccupancyRow = { hour: string; reservations: number; covers: number };

export async function getHourlyOccupancy(restaurantId: string, range: DateRange): Promise<HourlyOccupancyRow[]> {
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ start_time: string; party_size: number; status: string }> }> } } } };
  }).from("reservations").select("start_time,party_size,status").eq("restaurant_id", restaurantId).gte("reservation_date", range.from).lte("reservation_date", range.to);
  const rows = data ?? [];
  const map = new Map<number, { reservations: number; covers: number }>();
  for (const r of rows) {
    if (!r.start_time || ["cancelled", "hold"].includes(r.status)) continue;
    const h = new Date(r.start_time).getHours();
    const cur = map.get(h) ?? { reservations: 0, covers: 0 };
    cur.reservations += 1;
    if (r.status !== "no_show") cur.covers += r.party_size;
    map.set(h, cur);
  }
  return Array.from(map.keys()).sort((a, b) => a - b).map((h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    reservations: map.get(h)!.reservations,
    covers: map.get(h)!.covers,
  }));
}

// ---------- Top tables & zones ----------
export type TopTableRow = { tableId: string; label: string; zoneName: string | null; reservations: number; covers: number };
export type TopZoneRow = { zoneName: string; reservations: number; covers: number };
export type TopSeatingMetrics = { tables: TopTableRow[]; zones: TopZoneRow[] };

export async function getTopSeatingMetrics(restaurantId: string, range: DateRange): Promise<TopSeatingMetrics> {
  const { data: resRows } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ id: string; party_size: number; status: string }> }> } } } };
  }).from("reservations").select("id,party_size,status").eq("restaurant_id", restaurantId).gte("reservation_date", range.from).lte("reservation_date", range.to);
  const reservations = (resRows ?? []).filter((r) => !["cancelled", "no_show", "hold"].includes(r.status));
  if (reservations.length === 0) return { tables: [], zones: [] };
  const resMap = new Map(reservations.map((r) => [r.id, r]));
  const ids = reservations.map((r) => r.id);

  const { data: rt } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { in: (c: string, v: unknown[]) => Promise<{ data: Array<{ reservation_id: string; table_id: string; tables: { id: string; label: string; zone_id: string | null } | null }> }> } };
  }).from("reservation_tables").select("reservation_id,table_id,tables(id,label,zone_id)").in("reservation_id", ids);

  const { data: zones } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => Promise<{ data: Array<{ id: string; name: string }> }> } };
  }).from("zones").select("id,name").eq("restaurant_id", restaurantId);
  const zoneNames = new Map((zones ?? []).map((z) => [z.id, z.name]));

  const tableMap = new Map<string, TopTableRow>();
  const zoneMap = new Map<string, TopZoneRow>();
  for (const link of rt ?? []) {
    const res = resMap.get(link.reservation_id);
    if (!res || !link.tables) continue;
    const zoneName = link.tables.zone_id ? (zoneNames.get(link.tables.zone_id) ?? null) : null;
    const tRow = tableMap.get(link.table_id) ?? { tableId: link.table_id, label: link.tables.label, zoneName, reservations: 0, covers: 0 };
    tRow.reservations += 1;
    tRow.covers += res.party_size;
    tableMap.set(link.table_id, tRow);
    const zKey = zoneName ?? "Zonder zone";
    const zRow = zoneMap.get(zKey) ?? { zoneName: zKey, reservations: 0, covers: 0 };
    zRow.reservations += 1;
    zRow.covers += res.party_size;
    zoneMap.set(zKey, zRow);
  }
  return {
    tables: Array.from(tableMap.values()).sort((a, b) => b.reservations - a.reservations).slice(0, 8),
    zones: Array.from(zoneMap.values()).sort((a, b) => b.reservations - a.reservations),
  };
}

// ---------- Reminder metrics ----------
export type ReminderMetrics = {
  totalSent: number;
  byType: Record<string, number>;
  failed: number;
  pending: number;
  reconfirmationsSent: number;
  cancelledOnTime: number;
};

export async function getReminderMetrics(restaurantId: string, range: DateRange, cutoffMinutes = 120): Promise<ReminderMetrics> {
  const fromTs = `${range.from}T00:00:00Z`;
  const toTs = `${range.to}T23:59:59Z`;
  const { data } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ status: string; reminder_type: string }> }> } } } };
  }).from("reservation_reminders").select("status,reminder_type").eq("restaurant_id", restaurantId).gte("scheduled_for", fromTs).lte("scheduled_for", toTs);
  const rows = data ?? [];
  const byType: Record<string, number> = {};
  let totalSent = 0, failed = 0, pending = 0, reconf = 0;
  for (const r of rows) {
    if (r.status === "sent") {
      totalSent += 1;
      byType[r.reminder_type] = (byType[r.reminder_type] ?? 0) + 1;
      if (r.reminder_type === "reconfirmation") reconf += 1;
    } else if (r.status === "failed") failed += 1;
    else if (["pending", "scheduled"].includes(r.status)) pending += 1;
  }

  const { data: cancels } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ start_time: string; cancelled_at: string | null }> }> } } } } };
  }).from("reservations").select("start_time,cancelled_at").eq("restaurant_id", restaurantId).eq("status", "cancelled").gte("reservation_date", range.from).lte("reservation_date", range.to);
  const cutoffMs = cutoffMinutes * 60_000;
  let onTime = 0;
  for (const c of cancels ?? []) {
    if (!c.cancelled_at || !c.start_time) continue;
    if (new Date(c.start_time).getTime() - new Date(c.cancelled_at).getTime() >= cutoffMs) onTime += 1;
  }
  return { totalSent, byType, failed, pending, reconfirmationsSent: reconf, cancelledOnTime: onTime };
}

// ---------- AI Voice Agent performance ----------
export type AIPerformanceMetrics = {
  totalCalls: number;
  successfulBookings: number;
  failedBookings: number;
  handovers: number;
  avgDurationSeconds: number;
  byOutcome: Record<string, number>;
  topErrorCodes: Array<{ code: string; count: number }>;
  successRate: number;
};

export async function getAIPerformanceMetrics(restaurantId: string, range: DateRange): Promise<AIPerformanceMetrics> {
  const fromTs = `${range.from}T00:00:00Z`;
  const toTs = `${range.to}T23:59:59Z`;
  const { data: calls } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ outcome: string | null; duration_seconds: number | null; reservation_id: string | null }> }> } } } };
  }).from("agent_call_logs").select("outcome,duration_seconds,reservation_id").eq("restaurant_id", restaurantId).gte("created_at", fromTs).lte("created_at", toTs);
  const rows = calls ?? [];
  const byOutcome: Record<string, number> = {};
  let successful = 0, failed = 0, handovers = 0, durSum = 0, durCount = 0;
  for (const r of rows) {
    const o = r.outcome ?? "unknown";
    byOutcome[o] = (byOutcome[o] ?? 0) + 1;
    const isHandover = ["handover", "transferred", "human_handover"].includes(o);
    if (isHandover) handovers += 1;
    if (["booked", "reservation_created", "success"].includes(o) || (r.reservation_id && !isHandover)) successful += 1;
    else if (["failed", "error", "no_availability", "validation_failed"].includes(o)) failed += 1;
    if (typeof r.duration_seconds === "number") { durSum += r.duration_seconds; durCount += 1; }
  }

  const { data: errs } = await (supabase as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => Promise<{ data: Array<{ error_code: string | null }> }> } } } } } };
  }).from("integration_logs").select("error_code").eq("restaurant_id", restaurantId).eq("source", "voice_agent").eq("status", "failed").gte("created_at", fromTs).lte("created_at", toTs);
  const errMap = new Map<string, number>();
  for (const e of errs ?? []) {
    if (!e.error_code) continue;
    errMap.set(e.error_code, (errMap.get(e.error_code) ?? 0) + 1);
  }
  const topErrorCodes = Array.from(errMap.entries()).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  return {
    totalCalls: rows.length,
    successfulBookings: successful,
    failedBookings: failed,
    handovers,
    avgDurationSeconds: durCount > 0 ? Math.round(durSum / durCount) : 0,
    byOutcome,
    topErrorCodes,
    successRate: safePct(successful, rows.length),
  };
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

