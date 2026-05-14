// Shared capacity & pacing helpers.
// Determines whether a candidate slot is operationally allowed based on:
//  - max covers (sum of party_size) overlapping the slot window
//  - max number of new reservations starting within the same 15-min bucket
// Also computes peak-warning thresholds.

import { intervalsOverlap, ACTIVE_STATUSES } from "./reservation-utils.ts";
import { durationMinutesFor } from "./duration.ts";

export type PacingReservation = {
  id: string;
  start_time: string;
  end_time: string;
  party_size: number;
  status: string;
  hold_expires_at: string | null;
};

export type PacingConfig = {
  max_covers_per_slot: number | null;
  max_new_reservations_per_15min: number | null;
  peak_warning_threshold_pct: number;
};

export type PacingCheck = {
  ok: boolean;
  reason?: "covers_full" | "rate_full";
  covers_used: number;
  covers_limit: number | null;
  bucket_used: number;
  bucket_limit: number | null;
  peak_warning: boolean;
};

export function liveOnly(rows: PacingReservation[], now = new Date()): PacingReservation[] {
  return rows.filter((r) =>
    ACTIVE_STATUSES.includes(r.status as typeof ACTIVE_STATUSES[number]) &&
    (r.status !== "hold" || (r.hold_expires_at && new Date(r.hold_expires_at) > now))
  );
}

// Floor an ISO timestamp to the start of its 15-min bucket.
export function bucket15Iso(iso: string): string {
  const d = new Date(iso);
  const ms = d.getTime();
  const bucketMs = 15 * 60_000;
  return new Date(Math.floor(ms / bucketMs) * bucketMs).toISOString();
}

export function evaluatePacing(
  candidate: { start_iso: string; end_iso: string; party_size: number },
  reservations: PacingReservation[],
  config: PacingConfig,
  excludeReservationId?: string,
): PacingCheck {
  const live = liveOnly(reservations).filter((r) => r.id !== excludeReservationId);

  // covers overlapping the candidate window
  let covers_used = 0;
  for (const r of live) {
    if (intervalsOverlap(candidate.start_iso, candidate.end_iso, r.start_time, r.end_time)) {
      covers_used += r.party_size ?? 0;
    }
  }
  // new reservations starting in same 15-min bucket as candidate
  const candidateBucket = bucket15Iso(candidate.start_iso);
  let bucket_used = 0;
  for (const r of live) {
    if (bucket15Iso(r.start_time) === candidateBucket) bucket_used += 1;
  }

  const projected_covers = covers_used + (candidate.party_size ?? 0);
  const projected_bucket = bucket_used + 1;

  const covers_limit = config.max_covers_per_slot ?? null;
  const bucket_limit = config.max_new_reservations_per_15min ?? null;

  if (covers_limit !== null && projected_covers > covers_limit) {
    return {
      ok: false, reason: "covers_full",
      covers_used, covers_limit, bucket_used, bucket_limit,
      peak_warning: true,
    };
  }
  if (bucket_limit !== null && projected_bucket > bucket_limit) {
    return {
      ok: false, reason: "rate_full",
      covers_used, covers_limit, bucket_used, bucket_limit,
      peak_warning: true,
    };
  }

  const threshold = (config.peak_warning_threshold_pct ?? 85) / 100;
  const peak_warning =
    (covers_limit !== null && projected_covers / covers_limit >= threshold) ||
    (bucket_limit !== null && projected_bucket / bucket_limit >= threshold);

  return { ok: true, covers_used, covers_limit, bucket_used, bucket_limit, peak_warning };
}

export function durationFor(
  party_size: number,
  defaults: {
    default_minutes: number;
    large_group_minutes: number;
    large_group_threshold: number;
    extra_large_group_threshold?: number | null;
    large_group_extra_minutes?: number | null;
  },
): number {
  return durationMinutesFor(party_size, {
    default_reservation_minutes: defaults.default_minutes,
    large_group_minutes: defaults.large_group_minutes,
    large_group_threshold: defaults.large_group_threshold,
    extra_large_group_threshold: defaults.extra_large_group_threshold ?? null,
    large_group_extra_minutes: defaults.large_group_extra_minutes ?? 0,
  });
}
