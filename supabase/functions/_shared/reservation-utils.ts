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
  excludedTableIds?: Set<string>,
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
    if (excludedTableIds && tableIds.some((id) => excludedTableIds.has(id))) continue;
    const allFree = tableIds.every((id) => !occupied.has(id));
    if (allFree) return { combinationId: c.id, tableIds, name: c.name };
  }
  return null;
}

/**
 * Zoek beschikbare zitplaats: eerst een losse passende tafel, daarna combinaties.
 * Gebruikt voor gast-flows (guest_reservation, review_guest_change) waar geen
 * zone-fill strategie nodig is. Retourneert combinationId=null voor losse tafels.
 */
// deno-lint-ignore no-explicit-any
export async function findAvailableSeating(
  sb: any,
  restaurantId: string,
  partySize: number,
  startIso: string,
  endIso: string,
  excludeReservationId?: string,
  excludedTableIds?: Set<string>,
): Promise<{ combinationId: string | null; tableIds: string[]; name: string | null } | null> {
  // 1. Single passende tafel
  const { data: tables } = await sb
    .from("tables")
    .select("id, capacity_min, capacity_max")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .lte("capacity_min", partySize)
    .gte("capacity_max", partySize)
    .order("capacity_max", { ascending: true });

  const candidateTables = ((tables ?? []) as Array<{ id: string }>)
    .filter((t) => !excludedTableIds?.has(t.id));

  if (candidateTables.length > 0) {
    const candidateIds = candidateTables.map((t) => t.id);
    const { data: rtRows } = await sb
      .from("reservation_tables")
      .select("table_id, reservation_id, reservations!inner(id, start_time, end_time, status, hold_expires_at)")
      .in("table_id", candidateIds);

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
    const free = candidateTables.find((t) => !occupied.has(t.id));
    if (free) return { combinationId: null, tableIds: [free.id], name: null };
  }

  // 2. Fallback: multi-tafel combinatie
  const combo = await findAvailableCombination(
    sb, restaurantId, partySize, startIso, endIso, excludeReservationId, excludedTableIds,
  );
  if (!combo) return null;
  return { combinationId: combo.combinationId, tableIds: combo.tableIds, name: combo.name };
}

/**
 * Strategie-bewuste zitplaats-picker. Past de vul-strategie toe (zones, fill_priority,
 * terras-voorkeur, weer-blokkering) wanneer fill_strategy_enabled aanstaat voor het
 * restaurant. Anders valt terug op findAvailableSeating (eerste passende losse tafel,
 * dan combinatie).
 *
 * Gebruikt door alle herboeking/wijzig-flows zodat een gast die z'n tijd verplaatst
 * niet ineens in een achterkamer-zone belandt terwijl het terras leeg staat.
 */
// deno-lint-ignore no-explicit-any
export async function pickSeatingWithStrategy(
  sb: any,
  opts: {
    restaurantId: string;
    partySize: number;
    startIso: string;
    endIso: string;
    timezone: string;
    date: string; // YYYY-MM-DD voor weather lookup
    excludeReservationId?: string;
    excludedTableIds?: Set<string>;
    prefersTerrace?: boolean;
  },
): Promise<
  | { combinationId: string | null; tableIds: string[]; name: string | null; zoneId: string | null; terracePreferenceUnmet: boolean }
  | null
> {
  const {
    restaurantId, partySize, startIso, endIso, timezone, date,
    excludeReservationId, excludedTableIds, prefersTerrace,
  } = opts;

  // Lees fill_strategy_enabled van het restaurant
  const { data: rest } = await sb
    .from("restaurants")
    .select("fill_strategy_enabled")
    .eq("id", restaurantId)
    .maybeSingle();
  const useFillStrategy = rest?.fill_strategy_enabled === true;

  if (!useFillStrategy) {
    const legacy = await findAvailableSeating(
      sb, restaurantId, partySize, startIso, endIso, excludeReservationId, excludedTableIds,
    );
    if (!legacy) return null;
    return { ...legacy, zoneId: null, terracePreferenceUnmet: !!prefersTerrace };
  }

  // Dynamisch importeren om circulaire imports te vermijden
  const { resolveActiveZones, pickTableWithFillStrategy, pickCombinationWithFillStrategy } =
    await import("./zone-fill.ts");

  // Parallel: zones, alle actieve tafels, fitting tafels, weer-row
  const [zonesRes, allTablesRes, fittingRes, weatherRes] = await Promise.all([
    sb.from("zones").select("*").eq("restaurant_id", restaurantId),
    sb.from("tables").select("id, zone_id, is_active, capacity_min, capacity_max, fill_priority, label")
      .eq("restaurant_id", restaurantId).eq("is_active", true),
    sb.from("tables").select("id, zone_id, capacity_min, capacity_max, fill_priority, label")
      .eq("restaurant_id", restaurantId).eq("is_active", true)
      .lte("capacity_min", partySize).gte("capacity_max", partySize),
    sb.from("weather_forecasts").select("min_temp_c, max_temp_c, precipitation_mm")
      .eq("restaurant_id", restaurantId).eq("date", date).maybeSingle(),
  ]);

  const zones = (zonesRes.data ?? []) as any[];
  const allTables = (allTablesRes.data ?? []) as Array<{ id: string; zone_id: string | null }>;
  const fittingTables = (fittingRes.data ?? []) as Array<{
    id: string; zone_id: string | null; capacity_min: number; capacity_max: number; fill_priority: number; label: string;
  }>;
  const weather = (weatherRes.data ?? null) as any;

  const zoneActivity = resolveActiveZones({
    zones, partySize, startIso, timezone, weather,
  });

  // Bereken occupancy voor het gewenste tijdvenster
  const allTableIds = allTables.map((t) => t.id);
  const occupied = new Set<string>();
  if (allTableIds.length > 0) {
    const { data: rtRows } = await sb
      .from("reservation_tables")
      .select("table_id, reservation_id, reservations!inner(id, start_time, end_time, status, hold_expires_at)")
      .in("table_id", allTableIds);
    const now = new Date();
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
  }

  // Occupancy per zone (op basis van alle actieve tafels)
  const occupancyByZone = new Map<string, { occupied: number; total: number }>();
  for (const z of zones) occupancyByZone.set(z.id, { occupied: 0, total: 0 });
  for (const t of allTables) {
    if (!t.zone_id) continue;
    const entry = occupancyByZone.get(t.zone_id);
    if (!entry) continue;
    entry.total += 1;
    if (occupied.has(t.id)) entry.occupied += 1;
  }

  // Fitting + vrij + niet excluded
  const freeFitting = fittingTables.filter((t) =>
    !occupied.has(t.id) && !excludedTableIds?.has(t.id)
  );

  const picked = pickTableWithFillStrategy({
    fittingFreeTables: freeFitting,
    zoneActivity,
    occupancyByZone,
    prefersTerrace: !!prefersTerrace,
    partySize,
  });

  if (picked) {
    return {
      combinationId: null,
      tableIds: [picked.tableId],
      name: null,
      zoneId: picked.zoneId,
      terracePreferenceUnmet: picked.terrace_preference_unmet,
    };
  }

  // Combinatie-fallback
  const { data: combosRaw } = await sb
    .from("table_combinations")
    .select("id, name, table_ids, capacity_min, capacity_max, fill_priority, is_active")
    .eq("restaurant_id", restaurantId).eq("is_active", true);
  const combinations = (combosRaw ?? []) as any[];
  const tablesById = new Map<string, any>();
  for (const t of fittingTables) tablesById.set(t.id, t);
  // Aanvullen met overige tafels die in combinaties zitten maar niet "fitting" zijn los
  const comboTableIds = Array.from(new Set(combinations.flatMap((c) => c.table_ids ?? [])));
  const missing = comboTableIds.filter((id) => !tablesById.has(id));
  if (missing.length > 0) {
    const { data: extra } = await sb
      .from("tables").select("id, zone_id, capacity_min, capacity_max, fill_priority, label")
      .in("id", missing);
    for (const t of (extra ?? []) as any[]) tablesById.set(t.id, t);
  }

  const filteredCombos = excludedTableIds
    ? combinations.filter((c) => !(c.table_ids ?? []).some((id: string) => excludedTableIds.has(id)))
    : combinations;

  const pickedCombo = pickCombinationWithFillStrategy({
    combinations: filteredCombos,
    tablesById,
    occupiedTableIds: occupied,
    zoneActivity,
    prefersTerrace: !!prefersTerrace,
    partySize,
  });
  if (!pickedCombo) return null;
  return {
    combinationId: pickedCombo.combinationId,
    tableIds: pickedCombo.tableIds,
    name: pickedCombo.name,
    zoneId: null,
    terracePreferenceUnmet: pickedCombo.terrace_preference_unmet,
  };
}

