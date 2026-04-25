// Safe Dutch parser for "AI Quick Seat" natural-language input.
// Pure regex/keyword heuristics — no LLM call.
// Returns a structured interpretation with a confidence flag so the UI
// can demand human confirmation when uncertain.

export type ParsedQuickSeat = {
  partySize: number | null;
  zoneHint: string | null;     // e.g. "terras" — caller maps to zone_id
  durationMinutes: number | null;
  immediate: boolean;          // "nu" / "direct"
  noteFragment: string | null; // unparsed remainder, e.g. "rustig tafeltje"
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

const ZONE_KEYWORDS: Record<string, string[]> = {
  terras:  ["terras", "buiten", "tuin"],
  binnen:  ["binnen", "binnenruimte", "binnenzaal", "zaal"],
  bar:     ["bar", "barzitje", "bartafel"],
  serre:   ["serre", "veranda"],
};

const PARTY_NUMWORDS: Record<string, number> = {
  een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6,
  zeven: 7, acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12,
};

export function parseQuickSeat(rawInput: string): ParsedQuickSeat {
  const warnings: string[] = [];
  const input = rawInput.toLowerCase().trim();
  if (input.length === 0) {
    return { partySize: null, zoneHint: null, durationMinutes: null,
      immediate: false, noteFragment: null, confidence: "low",
      warnings: ["Voer iets in om te starten."] };
  }
  if (input.length > 200) {
    warnings.push("Te lang — alleen de eerste regel wordt bekeken.");
  }
  const text = input.slice(0, 200);

  // ---- Party size ----
  let partySize: number | null = null;
  // Patterns: "4p", "voor 3", "groep 5", "2 personen", "1 persoon"
  const compactMatch = text.match(/\b(\d{1,2})\s?(?:p|pers|persoon|personen|gasten|stuks)\b/);
  if (compactMatch) partySize = parseInt(compactMatch[1], 10);
  if (!partySize) {
    const voorMatch = text.match(/\bvoor\s+(\d{1,2})\b/);
    if (voorMatch) partySize = parseInt(voorMatch[1], 10);
  }
  if (!partySize) {
    const groupMatch = text.match(/\b(?:groep|gezelschap|tafel)\s+(?:van\s+)?(\d{1,2})\b/);
    if (groupMatch) partySize = parseInt(groupMatch[1], 10);
  }
  if (!partySize) {
    // numwords: "twee personen", "vier"
    for (const [word, n] of Object.entries(PARTY_NUMWORDS)) {
      const re = new RegExp(`\\b${word}\\b\\s+(?:personen|persoon|gasten|p)`);
      if (re.test(text)) { partySize = n; break; }
    }
  }
  if (!partySize) {
    // last-resort lone number 1..20
    const lone = text.match(/(?<!\d)(\d{1,2})(?!\d)/);
    if (lone) {
      const n = parseInt(lone[1], 10);
      if (n >= 1 && n <= 20) {
        partySize = n;
        warnings.push("Aantal personen geraden uit een los getal.");
      }
    }
  }
  if (partySize !== null && (partySize < 1 || partySize > 50)) {
    warnings.push("Aantal personen lijkt onrealistisch.");
    partySize = null;
  }

  // ---- Zone ----
  let zoneHint: string | null = null;
  outer: for (const [zone, keywords] of Object.entries(ZONE_KEYWORDS)) {
    for (const kw of keywords) {
      if (new RegExp(`\\b${kw}\\b`).test(text)) { zoneHint = zone; break outer; }
    }
  }

  // ---- Duration ----
  let durationMinutes: number | null = null;
  const minMatch = text.match(/\b(\d{1,3})\s?(?:m|min|minuten)\b/);
  if (minMatch) {
    const m = parseInt(minMatch[1], 10);
    if (m >= 15 && m <= 240) durationMinutes = m;
  }
  if (durationMinutes === null) {
    if (/\banderhalf\s*uur\b/.test(text)) durationMinutes = 90;
    else if (/\bhalf\s*uur\b/.test(text)) durationMinutes = 30;
    else {
      const hourMatch = text.match(/\b(\d{1,2})(?:[.,](\d))?\s*uur\b/);
      if (hourMatch) {
        const hours = parseInt(hourMatch[1], 10);
        const decimals = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;
        const total = hours * 60 + (decimals === 5 ? 30 : decimals * 6);
        if (total >= 30 && total <= 240) durationMinutes = total;
      }
    }
  }

  // ---- Immediate ----
  const immediate = /\b(nu|direct|meteen|asap)\b/.test(text);

  // ---- Note fragment: anything after stripping recognised tokens ----
  let remainder = text
    .replace(/\b\d{1,2}\s?(?:p|pers|persoon|personen|gasten|stuks)\b/g, "")
    .replace(/\bvoor\s+\d{1,2}\b/g, "")
    .replace(/\b(?:groep|gezelschap|tafel)\s+(?:van\s+)?\d{1,2}\b/g, "")
    .replace(/\b\d{1,3}\s?(?:m|min|minuten)\b/g, "")
    .replace(/\banderhalf\s*uur\b/g, "")
    .replace(/\b\d{1,2}(?:[.,]\d)?\s*uur\b/g, "")
    .replace(/\b(nu|direct|meteen|asap|walk-?in)\b/g, "");
  for (const keywords of Object.values(ZONE_KEYWORDS)) {
    for (const kw of keywords) remainder = remainder.replace(new RegExp(`\\b${kw}\\b`, "g"), "");
  }
  remainder = remainder.replace(/[,.;:!?]/g, " ").replace(/\s+/g, " ").trim();
  const noteFragment = remainder.length > 1 ? remainder.slice(0, 100) : null;

  // ---- Confidence ----
  let confidence: ParsedQuickSeat["confidence"] = "high";
  if (partySize === null) confidence = "low";
  else if (warnings.length > 0) confidence = "medium";
  else if (!zoneHint && !durationMinutes && !immediate && noteFragment) confidence = "medium";

  return { partySize, zoneHint, durationMinutes, immediate, noteFragment, confidence, warnings };
}
