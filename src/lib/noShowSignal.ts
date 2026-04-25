// noShowSignal — explainable, low-tech no-show risk indicator.
// Pure function: caller passes the reservation + guest data we have, we return
// a level (`low | medium | high`) and a list of human-readable reasons.
//
// Hard rules:
// - never use sensitive or discriminatory factors (gender, name origin, etc.)
// - never block a guest based on this score
// - keep reasons short and friendly — they may be shown to operators

export type RiskLevel = "low" | "medium" | "high";

export type RiskInput = {
  partySize: number;
  largeGroupThreshold?: number;
  hasPhone: boolean;
  hasEmail: boolean;
  guestVisitCount?: number | null;
  guestNoShowCount?: number | null;
  reconfirmationStatus?: string | null;
  startTimeIso?: string;
  // Optional: caller can pass `peakHour: true` if shift/pacing flagged it.
  isPeak?: boolean;
};

export type RiskResult = {
  level: RiskLevel;
  reasons: string[];
};

export function calculateNoShowSignal(input: RiskInput): RiskResult {
  const reasons: string[] = [];
  let score = 0;

  if (input.guestNoShowCount && input.guestNoShowCount > 0) {
    score += input.guestNoShowCount >= 2 ? 3 : 2;
    reasons.push(
      input.guestNoShowCount === 1
        ? "Eerdere no-show"
        : `${input.guestNoShowCount} eerdere no-shows`,
    );
  }

  const isLargeGroup =
    input.largeGroupThreshold !== undefined &&
    input.partySize >= input.largeGroupThreshold;
  if (isLargeGroup) {
    score += 1;
    reasons.push("Grote groep");
  }

  if (!input.guestVisitCount || input.guestVisitCount === 0) {
    score += 1;
    reasons.push("Nieuwe gast");
  }

  if (!input.hasPhone) {
    score += 1;
    reasons.push("Geen telefoonnummer");
  }
  if (!input.hasEmail) {
    score += 1;
    reasons.push("Geen e-mailadres");
  }

  if (input.isPeak) {
    score += 1;
    reasons.push("Piekmoment");
  }

  if (
    input.startTimeIso &&
    input.reconfirmationStatus === "requested"
  ) {
    const hoursToStart =
      (new Date(input.startTimeIso).getTime() - Date.now()) / 3_600_000;
    if (hoursToStart < 4 && hoursToStart > 0) {
      score += 2;
      reasons.push("Herbevestiging open");
    }
  }

  let level: RiskLevel = "low";
  if (score >= 4) level = "high";
  else if (score >= 2) level = "medium";

  return { level, reasons };
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Geen extra actie nodig",
  medium: "Extra bevestiging aanbevolen",
  high: "Handmatige check aanbevolen",
};
