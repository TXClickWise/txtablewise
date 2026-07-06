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
