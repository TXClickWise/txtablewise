// Zone fill-strategie helper — pure logica, geen netwerk.
// Bepaalt welke zones nú actief zijn (op weekdag, tijd, party-size, weer) en
// kiest de beste tafel uit een lijst van fitting + vrije tafels, gestuurd door
// fill_priority en fill_threshold_pct per zone.

export type ZoneRow = {
  id: string;
  name: string;
  fill_priority: number;
  fill_threshold_pct: number;
  min_party_size: number;
  max_party_size: number;
  active_weekdays: string[];
  active_time_from: string | null; // "HH:MM:SS" or "HH:MM"
  active_time_to: string | null;
  weather_dependent: boolean;
  weather_min_temp_c: number | null;
  weather_blocks_on_precipitation: boolean;
  is_terrace: boolean;
  is_active: boolean;
};

export type TableRow = {
  id: string;
  zone_id: string | null;
  capacity_min: number;
  capacity_max: number;
  fill_priority: number;
  label?: string;
};

export type WeatherRow = {
  min_temp_c: number | null;
  max_temp_c: number | null;
  precipitation_mm: number | null;
};

export type ZoneActivity = {
  zone: ZoneRow;
  active: boolean;
  blockedReason?: string;
};

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function weekdayKey(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: timezone });
  return fmt.format(date).toLowerCase();
}

function hhmmInTz(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

function timeLte(a: string, b: string) {
  return a.slice(0, 5) <= b.slice(0, 5);
}
function timeGte(a: string, b: string) {
  return a.slice(0, 5) >= b.slice(0, 5);
}

/** Determine which zones are open right now for this booking context. */
export function resolveActiveZones(input: {
  zones: ZoneRow[];
  partySize: number;
  startIso: string;
  timezone: string;
  weather?: WeatherRow | null;
}): ZoneActivity[] {
  const start = new Date(input.startIso);
  const wd = weekdayKey(start, input.timezone);
  const hhmm = hhmmInTz(start, input.timezone);

  return input.zones.map((z) => {
    if (!z.is_active) return { zone: z, active: false, blockedReason: "Zone niet actief" };
    if (input.partySize < z.min_party_size) return { zone: z, active: false, blockedReason: "Groep te klein voor zone" };
    if (input.partySize > z.max_party_size) return { zone: z, active: false, blockedReason: "Groep te groot voor zone" };
    const weekdays = z.active_weekdays?.length ? z.active_weekdays : WEEKDAY_KEYS;
    if (!weekdays.includes(wd)) return { zone: z, active: false, blockedReason: "Zone niet actief op deze dag" };
    if (z.active_time_from && timeLte(hhmm, z.active_time_from) && hhmm !== z.active_time_from.slice(0, 5)) {
      return { zone: z, active: false, blockedReason: `Zone opent om ${z.active_time_from.slice(0, 5)}` };
    }
    if (z.active_time_to && timeGte(hhmm, z.active_time_to)) {
      return { zone: z, active: false, blockedReason: `Zone sluit om ${z.active_time_to.slice(0, 5)}` };
    }
    if (z.weather_dependent && input.weather) {
      if (z.weather_blocks_on_precipitation && (input.weather.precipitation_mm ?? 0) > 0.5) {
        return { zone: z, active: false, blockedReason: "Regen verwacht" };
      }
      if (z.weather_min_temp_c !== null && input.weather.max_temp_c !== null && input.weather.max_temp_c < z.weather_min_temp_c) {
        return { zone: z, active: false, blockedReason: `Te koud (< ${z.weather_min_temp_c}°C)` };
      }
    }
    return { zone: z, active: true };
  });
}

export type PickResult = {
  tableId: string;
  zoneId: string | null;
  reason: string;
  terrace_preference_unmet: boolean;
};

/** Pick a single table using fill strategy. Returns null if no fitting+free table. */
export function pickTableWithFillStrategy(input: {
  fittingFreeTables: TableRow[];
  zoneActivity: ZoneActivity[];
  occupancyByZone: Map<string, { occupied: number; total: number }>;
  prefersTerrace: boolean;
  partySize: number;
}): PickResult | null {
  const { fittingFreeTables, zoneActivity, occupancyByZone, prefersTerrace, partySize } = input;
  if (fittingFreeTables.length === 0) return null;

  // Map zone_id -> activity
  const zoneById = new Map(zoneActivity.map((za) => [za.zone.id, za]));

  // 1. Filter tafels: zone moet actief zijn (tafels zonder zone blijven toegestaan)
  const candidates = fittingFreeTables.filter((t) => {
    if (!t.zone_id) return true;
    const za = zoneById.get(t.zone_id);
    return !za || za.active;
  });

  // Edge: niets actief → val terug op alle fitting tafels (geen ongewenste "no table")
  const pool = candidates.length > 0 ? candidates : fittingFreeTables;

  // 2. Terras-voorkeur: probeer eerst een actieve terras-zone
  let terrace_preference_unmet = false;
  if (prefersTerrace) {
    const terraceZoneIds = new Set(
      zoneActivity.filter((za) => za.active && za.zone.is_terrace).map((za) => za.zone.id),
    );
    const terraceCandidates = pool.filter((t) => t.zone_id && terraceZoneIds.has(t.zone_id));
    if (terraceCandidates.length > 0) {
      const winner = sortByFit(terraceCandidates, partySize)[0];
      return { tableId: winner.id, zoneId: winner.zone_id, reason: "Terras-voorkeur gehonoreerd", terrace_preference_unmet: false };
    }
    terrace_preference_unmet = true;
  }

  // 3. Bereken voor elke kandidaat-tafel "effectieve zone-prio".
  //    Een zone wordt pas "vrijgegeven" als ALLE eerdere (lagere fill_priority)
  //    actieve zones hun fill_threshold_pct hebben gehaald.
  const activeZonesSorted = [...zoneActivity]
    .filter((za) => za.active)
    .map((za) => za.zone)
    .sort((a, b) => a.fill_priority - b.fill_priority);

  // Bepaal "primary zone(s)": eerste zone in volgorde die nog niet vol is.
  // Alles vóór die zone is gevuld → niet meer relevant; alles na die zone is "secundair".
  let primaryIdx = activeZonesSorted.length; // default: alle vol → laatste wint
  for (let i = 0; i < activeZonesSorted.length; i++) {
    const z = activeZonesSorted[i];
    const occ = occupancyByZone.get(z.id);
    const total = occ?.total ?? 0;
    const occupied = occ?.occupied ?? 0;
    const pct = total > 0 ? (occupied / total) * 100 : 0;
    if (total === 0 || pct < z.fill_threshold_pct) {
      primaryIdx = i;
      break;
    }
  }

  const zonePriorityRank = new Map<string, number>();
  activeZonesSorted.forEach((z, i) => {
    // Lagere rank = hogere voorkeur. Zone vóór primary = al vol, gelijk gerangschikt na primary.
    // Zone op primaryIdx = beste. Verdere zones = oplopend slechter.
    const rank = i < primaryIdx ? 1000 + i : i - primaryIdx;
    zonePriorityRank.set(z.id, rank);
  });

  const scored = pool.map((t) => {
    const zoneRank = t.zone_id ? (zonePriorityRank.get(t.zone_id) ?? 9999) : 5000;
    const fitWaste = t.capacity_max - partySize;
    return { table: t, zoneRank, fitWaste };
  });

  scored.sort((a, b) => {
    if (a.zoneRank !== b.zoneRank) return a.zoneRank - b.zoneRank;
    if (a.fitWaste !== b.fitWaste) return a.fitWaste - b.fitWaste;
    if (a.table.fill_priority !== b.table.fill_priority) return a.table.fill_priority - b.table.fill_priority;
    return (a.table.label ?? "").localeCompare(b.table.label ?? "");
  });

  const winner = scored[0].table;
  const zoneName = winner.zone_id ? zoneById.get(winner.zone_id)?.zone.name ?? "zone" : "geen zone";
  return {
    tableId: winner.id,
    zoneId: winner.zone_id,
    reason: `Vul-strategie: ${zoneName}`,
    terrace_preference_unmet,
  };
}

function sortByFit(tables: TableRow[], partySize: number): TableRow[] {
  return [...tables].sort((a, b) => {
    const wa = a.capacity_max - partySize;
    const wb = b.capacity_max - partySize;
    if (wa !== wb) return wa - wb;
    if (a.fill_priority !== b.fill_priority) return a.fill_priority - b.fill_priority;
    return (a.label ?? "").localeCompare(b.label ?? "");
  });
}

// ---------- Combinaties ----------

export type CombinationRow = {
  id: string;
  name: string;
  table_ids: string[];
  capacity_min: number;
  capacity_max: number;
  fill_priority: number;
  is_active: boolean;
};

export type PickCombinationResult = {
  combinationId: string;
  tableIds: string[];
  name: string;
  reason: string;
  terrace_preference_unmet: boolean;
};

/**
 * Kies een tafelcombinatie volgens dezelfde vul-strategie als losse tafels.
 * - single-zone combinaties krijgen voorrang op cross-zone combinaties
 * - combinaties met tafels in nu-niet-actieve zones zijn laatste fallback
 * - terras-voorkeur: combinaties die volledig in een actieve terras-zone vallen winnen
 */
export function pickCombinationWithFillStrategy(input: {
  combinations: CombinationRow[];
  tablesById: Map<string, TableRow>;
  occupiedTableIds: Set<string>;
  zoneActivity: ZoneActivity[];
  prefersTerrace: boolean;
  partySize: number;
}): PickCombinationResult | null {
  const { combinations, tablesById, occupiedTableIds, zoneActivity, prefersTerrace, partySize } = input;
  if (combinations.length === 0) return null;

  const zoneById = new Map(zoneActivity.map((za) => [za.zone.id, za]));
  const activeZonesSorted = [...zoneActivity]
    .filter((za) => za.active)
    .map((za) => za.zone)
    .sort((a, b) => a.fill_priority - b.fill_priority);
  const zoneRank = new Map<string, number>();
  activeZonesSorted.forEach((z, i) => zoneRank.set(z.id, i));

  type Scored = {
    combo: CombinationRow;
    capacityWaste: number;
    crossZone: boolean;
    containsInactiveZone: boolean;
    terraceOnly: boolean;
    effectivePriority: number;
  };

  const scored: Scored[] = [];
  for (const c of combinations) {
    if (!c.is_active) continue;
    if (partySize < c.capacity_min || partySize > c.capacity_max) continue;
    const tableIds = c.table_ids ?? [];
    if (tableIds.length === 0) continue;
    if (tableIds.some((id) => occupiedTableIds.has(id))) continue;

    const tablesInCombo = tableIds.map((id) => tablesById.get(id)).filter(Boolean) as TableRow[];
    if (tablesInCombo.length !== tableIds.length) continue; // metadata mismatch

    const zoneIds = new Set(tablesInCombo.map((t) => t.zone_id).filter(Boolean) as string[]);
    const crossZone = zoneIds.size > 1;
    const containsInactiveZone = tablesInCombo.some((t) => {
      if (!t.zone_id) return false;
      const za = zoneById.get(t.zone_id);
      return za ? !za.active : false;
    });
    const terraceOnly = tablesInCombo.length > 0 && tablesInCombo.every((t) => {
      if (!t.zone_id) return false;
      const za = zoneById.get(t.zone_id);
      return !!za?.active && za.zone.is_terrace;
    });

    // Effectieve prio: combinatie-override als die afwijkt van default (100),
    // anders minimum van zone-prio's van de bevatte tafels (lagere = hoger).
    let effectivePriority: number;
    if (c.fill_priority !== 100) {
      effectivePriority = c.fill_priority;
    } else {
      const ranks = tablesInCombo
        .map((t) => (t.zone_id ? zoneRank.get(t.zone_id) : undefined))
        .filter((r): r is number => r !== undefined);
      effectivePriority = ranks.length > 0 ? Math.min(...ranks) : 9999;
    }

    scored.push({
      combo: c,
      capacityWaste: c.capacity_max - partySize,
      crossZone,
      containsInactiveZone,
      terraceOnly,
      effectivePriority,
    });
  }

  if (scored.length === 0) return null;

  // Terras-voorkeur: probeer eerst terraceOnly + niet inactief
  if (prefersTerrace) {
    const terraceCands = scored.filter((s) => s.terraceOnly && !s.containsInactiveZone);
    if (terraceCands.length > 0) {
      terraceCands.sort(cmp);
      const w = terraceCands[0];
      return {
        combinationId: w.combo.id,
        tableIds: w.combo.table_ids,
        name: w.combo.name,
        reason: "Terras-combinatie (gast-voorkeur)",
        terrace_preference_unmet: false,
      };
    }
  }

  scored.sort(cmp);
  const winner = scored[0];
  const reason = winner.containsInactiveZone
    ? `Combinatie ${winner.combo.name} (bevat tafel in inactieve zone — laatste fallback)`
    : winner.crossZone
      ? `Cross-zone combinatie ${winner.combo.name}`
      : `Combinatie ${winner.combo.name}`;
  return {
    combinationId: winner.combo.id,
    tableIds: winner.combo.table_ids,
    name: winner.combo.name,
    reason,
    terrace_preference_unmet: prefersTerrace,
  };

  function cmp(a: Scored, b: Scored) {
    if (a.containsInactiveZone !== b.containsInactiveZone) return a.containsInactiveZone ? 1 : -1;
    if (a.crossZone !== b.crossZone) return a.crossZone ? 1 : -1;
    if (a.effectivePriority !== b.effectivePriority) return a.effectivePriority - b.effectivePriority;
    if (a.capacityWaste !== b.capacityWaste) return a.capacityWaste - b.capacityWaste;
    return a.combo.name.localeCompare(b.combo.name);
  }
}

