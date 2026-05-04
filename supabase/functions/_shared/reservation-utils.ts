// Shared helpers for reservation engine
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function getWeekdayKey(date: Date, timezone: string): string {
  // Use Intl to get weekday in restaurant timezone
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: timezone });
  const wd = fmt.format(date).toLowerCase();
  const map: Record<string, string> = {
    sun: "sun", mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat",
  };
  return map[wd];
}

// Build a UTC ISO timestamp for a given date (YYYY-MM-DD) + time (HH:MM) in the given IANA timezone.
// Approach: compute the offset of that wall-clock moment in the target tz, then subtract.
export function zonedDateTimeToUtcIso(dateStr: string, timeStr: string, timeZone: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  // Initial guess as if it were UTC
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0);
  // What does that instant look like in the target tz?
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(utcGuess));
  const get = (t: string) => Number(tzParts.find((p) => p.type === t)?.value);
  const asTzUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offset = asTzUtc - utcGuess;
  return new Date(utcGuess - offset).toISOString();
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

// Two intervals [aStart,aEnd) and [bStart,bEnd) overlap if aStart < bEnd && bStart < aEnd
export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export const ACTIVE_STATUSES = ["hold", "pending", "confirmed", "seated"] as const;

/**
 * Zoek een beschikbare tafelcombinatie voor het gevraagde aantal gasten.
 * Best fit: combinatie met de kleinste capacity_max die past en waarvan ALLE tafels vrij zijn.
 * Returns null als geen combinatie beschikbaar is.
 */
// deno-lint-ignore no-explicit-any
export async function findAvailableCombination(
  sb: any,
  restaurantId: string,
  partySize: number,
  startIso: string,
  endIso: string,
  excludeReservationId?: string,
): Promise<{ combinationId: string; tableIds: string[]; name: string } | null> {
  const { data: combos } = await sb
    .from("table_combinations")
    .select("id, name, table_ids, capacity_min, capacity_max")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .lte("capacity_min", partySize)
    .gte("capacity_max", partySize)
    .order("capacity_max", { ascending: true });

  if (!combos || combos.length === 0) return null;

  // Verzamel alle tafel-ids die voorkomen in combinaties
  const allTableIds = Array.from(new Set(
    (combos as Array<{ table_ids: string[] }>).flatMap((c) => c.table_ids ?? []),
  ));
  if (allTableIds.length === 0) return null;

  // Haal overlappende reserveringen op voor deze tafels
  const { data: rtRows } = await sb
    .from("reservation_tables")
    .select("table_id, reservation_id, reservations!inner(id, start_time, end_time, status, hold_expires_at)")
    .in("table_id", allTableIds);

  const now = new Date();
  const occupied = new Set<string>();
  // deno-lint-ignore no-explicit-any
  for (const row of (rtRows ?? []) as any[]) {
    const r = row.reservations;
    if (!r) continue;
    if (excludeReservationId && r.id === excludeReservationId) continue;
    if (!ACTIVE_STATUSES.includes(r.status)) continue;
    if (r.status === "hold" && (!r.hold_expires_at || new Date(r.hold_expires_at) <= now)) continue;
    if (intervalsOverlap(startIso, endIso, r.start_time, r.end_time)) {
      occupied.add(row.table_id);
    }
  }

  for (const c of combos as Array<{ id: string; name: string; table_ids: string[] }>) {
    const tableIds = c.table_ids ?? [];
    if (tableIds.length === 0) continue;
    const allFree = tableIds.every((id) => !occupied.has(id));
    if (allFree) return { combinationId: c.id, tableIds, name: c.name };
  }
  return null;
}
