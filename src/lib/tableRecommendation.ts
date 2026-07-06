// Tafelaanbeveling — gedeelde scoringslogica voor Walk-in en AI Quick Seat.
// Pure functie, geen netwerk, geen state. UI kiest welke data ze inlevert.
import { differenceInMinutes } from "date-fns";

export type RecTable = {
  id: string;
  label: string;
  zone_id: string | null;
  capacity_min: number;
  capacity_max: number;
  combinable: boolean;
  shape: string;
};

export type RecReservation = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  reservation_tables: { table_id: string }[];
};

export type Suggestion = {
  table: RecTable;
  score: number;
  reasons: string[];
  /** Minuten tot eerstvolgende reservering ná onze duur. null = vrij. */
  freeUntilMinutes: number | null;
  freeUntilLabel: string | null;
  conflict: boolean;
  /** Reden waarom de tafel niet kan (bv. "te klein", "bezet tot 19:30"). */
  blockReason?: string;
};

export type RecCombination = {
  id: string;
  name: string;
  table_ids: string[];
  capacity_min: number;
  capacity_max: number;
};

export type ComboSuggestion = {
  kind: "combination";
  combinationId: string;
  name: string;
  tableIds: string[];
  tables: RecTable[];
  capacity_min: number;
  capacity_max: number;
  /** Primary zone id when alle tafels in dezelfde zone zitten, anders null. */
  zone_id: string | null;
  score: number;
  reasons: string[];
  freeUntilMinutes: number | null;
  freeUntilLabel: string | null;
  conflict: boolean;
  blockReason?: string;
};

export type RecommendOptions = {
  partySize: number;
  zoneId?: string | null;       // null/undefined = geen voorkeur
  durationMinutes: number;
  now?: Date;
  /** Wanneer true: ook bezette tafels meegeven (gemarkeerd met conflict). */
  includeBlocked?: boolean;
  largeGroupThreshold?: number;
};

const fmtHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function recommendTables(
  tables: RecTable[],
  reservations: RecReservation[],
  opts: RecommendOptions,
): Suggestion[] {
  const now = opts.now ?? new Date();
  const candidateEnd = new Date(now.getTime() + opts.durationMinutes * 60_000);
  const lgt = opts.largeGroupThreshold ?? 9;

  const scored: Suggestion[] = tables.map((t) => {
    const reasons: string[] = [];
    let score = 100;
    let blockReason: string | undefined;
    let conflict = false;

    // Filter by zone
    if (opts.zoneId && t.zone_id !== opts.zoneId) {
      blockReason = "Niet in gekozen zone";
    }

    // Capacity fit
    if (t.capacity_max < opts.partySize) {
      blockReason = blockReason ?? "Te klein voor dit gezelschap";
    } else if (t.capacity_min > opts.partySize) {
      // soft penalty: minimum bezetting niet gehaald
      score -= 8;
      reasons.push("Onder min. bezetting");
    }

    // Conflict detection
    const overlapping = reservations.find((r) => {
      if (!r.reservation_tables.some((rt) => rt.table_id === t.id)) return false;
      const rs = new Date(r.start_time);
      const re = new Date(r.end_time);
      return rs < candidateEnd && now < re;
    });
    if (overlapping) {
      conflict = true;
      blockReason = blockReason ?? `Bezet tot ${fmtHHMM(new Date(overlapping.end_time))}`;
    }

    // Capacity fit bonus (only meaningful when not blocked on capacity)
    if (t.capacity_max >= opts.partySize) {
      const fit = t.capacity_max - opts.partySize;
      if (fit === 0) { score += 40; reasons.push("Past precies"); }
      else if (fit === 1) { score += 25; reasons.push("Past goed"); }
      else if (fit <= 2) { score += 10; reasons.push("Past royaal"); }
      else { score -= fit * 6; reasons.push(`${fit} stoelen over`); }
    }

    // Reserve combinable tables for larger parties
    if (t.combinable && opts.partySize <= 4) score -= 15;

    // Zone-bonus
    if (opts.zoneId && t.zone_id === opts.zoneId) {
      score += 10;
      reasons.push("In gekozen zone");
    }

    // How long is the table free after our duration?
    const nextRes = reservations
      .filter((r) => r.reservation_tables.some((rt) => rt.table_id === t.id))
      .map((r) => new Date(r.start_time))
      .filter((d) => d > candidateEnd)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const freeUntilMinutes = nextRes ? differenceInMinutes(nextRes, now) : null;
    let freeUntilLabel: string | null = null;
    if (freeUntilMinutes === null) {
      reasons.push("Geen volgende reservering");
    } else {
      freeUntilLabel = fmtHHMM(nextRes!);
      reasons.push(`Vrij tot ${freeUntilLabel}`);
      if (freeUntilMinutes >= opts.durationMinutes + 30) score += 8;
    }

    // Large-group hint
    if (opts.partySize >= lgt && t.capacity_max >= opts.partySize) {
      reasons.push("Geschikt voor grote groep");
    }

    return { table: t, score, reasons, freeUntilMinutes, freeUntilLabel, conflict, blockReason };
  });

  // Filter: drop hard-blocked unless caller wants them
  const filtered = opts.includeBlocked
    ? scored
    : scored.filter((s) => !s.blockReason || (!s.conflict && s.table.capacity_max >= opts.partySize && (!opts.zoneId || s.table.zone_id === opts.zoneId)));

  return filtered.sort((a, b) => {
    // Available before blocked
    const ba = a.blockReason ? 1 : 0;
    const bb = b.blockReason ? 1 : 0;
    if (ba !== bb) return ba - bb;
    return b.score - a.score;
  });
}

/**
 * Score en filter tafelcombinaties voor het gewenste gezelschap.
 * Een combinatie is beschikbaar als ALLE deelnemende tafels vrij zijn tijdens onze duur.
 */
export function recommendCombinations(
  combinations: RecCombination[],
  tables: RecTable[],
  reservations: RecReservation[],
  opts: RecommendOptions,
): ComboSuggestion[] {
  const now = opts.now ?? new Date();
  const candidateEnd = new Date(now.getTime() + opts.durationMinutes * 60_000);
  const tablesById = new Map(tables.map((t) => [t.id, t]));

  const out: ComboSuggestion[] = combinations.map((c) => {
    const comboTables = (c.table_ids ?? [])
      .map((id) => tablesById.get(id))
      .filter((t): t is RecTable => !!t);
    const reasons: string[] = [];
    let score = 90; // iets lager dan losse tafel om single te preferen bij gelijke fit
    let blockReason: string | undefined;
    let conflict = false;

    if (comboTables.length === 0) {
      blockReason = "Combinatie zonder actieve tafels";
    }

    // Zone filter — vereist dat ALLE tafels in de gekozen zone zitten
    const zoneIds = Array.from(new Set(comboTables.map((t) => t.zone_id)));
    const zone_id = zoneIds.length === 1 ? zoneIds[0] : null;
    if (opts.zoneId && !comboTables.every((t) => t.zone_id === opts.zoneId)) {
      blockReason = blockReason ?? "Niet volledig in gekozen zone";
    }

    // Capaciteit
    if (c.capacity_max < opts.partySize) {
      blockReason = blockReason ?? "Te klein voor dit gezelschap";
    } else if (c.capacity_min > opts.partySize) {
      score -= 8;
      reasons.push("Onder min. bezetting");
    }

    // Conflict: enige tafel van de combinatie bezet?
    let earliestConflictEnd: Date | null = null;
    for (const t of comboTables) {
      const overlapping = reservations.find((r) => {
        if (!r.reservation_tables.some((rt) => rt.table_id === t.id)) return false;
        const rs = new Date(r.start_time);
        const re = new Date(r.end_time);
        return rs < candidateEnd && now < re;
      });
      if (overlapping) {
        conflict = true;
        const re = new Date(overlapping.end_time);
        if (!earliestConflictEnd || re < earliestConflictEnd) earliestConflictEnd = re;
      }
    }
    if (conflict) {
      const hh = String(earliestConflictEnd!.getHours()).padStart(2, "0");
      const mm = String(earliestConflictEnd!.getMinutes()).padStart(2, "0");
      blockReason = blockReason ?? `Deels bezet tot ${hh}:${mm}`;
    }

    // Capaciteit-fit bonus
    if (c.capacity_max >= opts.partySize) {
      const fit = c.capacity_max - opts.partySize;
      if (fit === 0) { score += 40; reasons.push("Past precies"); }
      else if (fit === 1) { score += 25; reasons.push("Past goed"); }
      else if (fit <= 2) { score += 10; reasons.push("Past royaal"); }
      else { score -= fit * 6; reasons.push(`${fit} stoelen over`); }
    }

    // Bonus voor grote groepen — combinaties zijn juist bedoeld hiervoor
    const lgt = opts.largeGroupThreshold ?? 9;
    if (opts.partySize >= lgt) {
      score += 15;
      reasons.push("Geschikt voor grote groep");
    }

    // Zone-bonus
    if (opts.zoneId && zone_id === opts.zoneId) {
      score += 10;
      reasons.push("In gekozen zone");
    }

    // Hoe lang nog vrij? Neem de vroegste volgende reservering op een van de tafels
    const nextTimes = comboTables
      .flatMap((t) =>
        reservations
          .filter((r) => r.reservation_tables.some((rt) => rt.table_id === t.id))
          .map((r) => new Date(r.start_time)),
      )
      .filter((d) => d > candidateEnd)
      .sort((a, b) => a.getTime() - b.getTime());
    const nextRes = nextTimes[0];
    const freeUntilMinutes = nextRes ? differenceInMinutes(nextRes, now) : null;
    let freeUntilLabel: string | null = null;
    if (freeUntilMinutes === null) {
      reasons.push("Geen volgende reservering");
    } else {
      const hh = String(nextRes!.getHours()).padStart(2, "0");
      const mm = String(nextRes!.getMinutes()).padStart(2, "0");
      freeUntilLabel = `${hh}:${mm}`;
      reasons.push(`Vrij tot ${freeUntilLabel}`);
      if (freeUntilMinutes >= opts.durationMinutes + 30) score += 8;
    }

    return {
      kind: "combination" as const,
      combinationId: c.id,
      name: c.name,
      tableIds: c.table_ids,
      tables: comboTables,
      capacity_min: c.capacity_min,
      capacity_max: c.capacity_max,
      zone_id,
      score,
      reasons,
      freeUntilMinutes,
      freeUntilLabel,
      conflict,
      blockReason,
    };
  });

  const filtered = opts.includeBlocked ? out : out.filter((s) => !s.blockReason);
  return filtered.sort((a, b) => {
    const ba = a.blockReason ? 1 : 0;
    const bb = b.blockReason ? 1 : 0;
    if (ba !== bb) return ba - bb;
    return b.score - a.score;
  });
}
