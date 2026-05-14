// Single source of truth for reservation duration in minutes.
// Used by availability, book, manage and pacing.
//
// Logic:
//   base = default_reservation_minutes
//   if party_size >= large_group_threshold → use large_group_minutes (absolute)
//   if extra_large_group_threshold set AND party_size >= extra_large_group_threshold
//     → add large_group_extra_minutes on top
export type DurationRestaurantConfig = {
  default_reservation_minutes?: number | null;
  large_group_minutes?: number | null;
  large_group_threshold?: number | null;
  extra_large_group_threshold?: number | null;
  large_group_extra_minutes?: number | null;
};

export function durationMinutesFor(
  partySize: number,
  r: DurationRestaurantConfig,
): number {
  const base = r.default_reservation_minutes ?? 105;
  const large = r.large_group_minutes ?? 150;
  const largeFrom = r.large_group_threshold ?? 9;
  const extraFrom = r.extra_large_group_threshold ?? null;
  const extra = r.large_group_extra_minutes ?? 0;

  let total = partySize >= largeFrom ? large : base;
  if (extraFrom != null && partySize >= extraFrom) total += extra;
  return total;
}
