// Central large-group rules — single source of truth for both creating (book_reservation)
// and changing (manage_reservation) a reservation.
//
// Two-threshold model:
//   party < largeFrom   → normal
//   party >= largeFrom  → large group (manual approval only from largeGroupManualFrom)
//   party >= xlFrom     → extra large, ALWAYS manual approval

// deno-lint-ignore no-explicit-any
export type RestaurantLike = Record<string, any>;

export type LargeGroupEvaluation = {
  isLargeGroup: boolean;
  requiresManualApproval: boolean;
  largeGroupStatus: string | null;
};

export function evaluateLargeGroup(
  partySize: number,
  restaurant: RestaurantLike,
  opts: { channel?: string } = {},
): LargeGroupEvaluation {
  const largeFrom: number = restaurant.large_group_threshold ?? 9;
  const xlFrom: number | null = restaurant.extra_large_group_threshold ?? null;
  const largeGroupManualFrom: number = restaurant.large_group_manual_approval_from ?? largeFrom;
  const manualApprovalSize: number | null = restaurant.manual_approval_from_party_size ?? null;

  const isLargeGroup = partySize >= largeFrom;
  let requiresManualApproval = false;
  let largeGroupStatus: string | null = null;

  if (xlFrom !== null && partySize >= xlFrom) {
    requiresManualApproval = true;
    largeGroupStatus = "awaiting_approval";
  } else if (isLargeGroup) {
    if (partySize >= largeGroupManualFrom) {
      requiresManualApproval = true;
      largeGroupStatus = "awaiting_approval";
    }
  }
  if (manualApprovalSize !== null && partySize >= manualApprovalSize) {
    requiresManualApproval = true;
  }
  if (opts.channel === "online" && restaurant.auto_confirm === false) {
    requiresManualApproval = true;
  }

  return { isLargeGroup, requiresManualApproval, largeGroupStatus };
}

/**
 * Re-evaluate an EXISTING reservation after its party size changed.
 * Returns the patch fields that must be applied, or null when nothing changes.
 *
 * Rules:
 * - small → large that needs approval: back to pending + awaiting_approval.
 * - large → small (or below the manual threshold) while approval was still pending:
 *   drop the approval flag and confirm.
 * - an already approved/declined large group keeps its decision.
 */
export function reevaluateLargeGroupOnUpdate(
  // deno-lint-ignore no-explicit-any
  current: any,
  newPartySize: number,
  restaurant: RestaurantLike,
): Record<string, unknown> | null {
  const previousStatus: string | null = current.large_group_status ?? null;
  // A decision that was already taken by staff is never silently reversed.
  if (previousStatus === "approved" || previousStatus === "declined") return null;
  if (newPartySize === current.party_size) return null;

  const evaluation = evaluateLargeGroup(newPartySize, restaurant, { channel: current.channel });
  const patch: Record<string, unknown> = {};

  if (evaluation.requiresManualApproval) {
    if (!current.requires_manual_approval || current.status !== "pending") {
      patch.requires_manual_approval = true;
      patch.large_group_status = evaluation.largeGroupStatus;
      if (["confirmed", "hold"].includes(current.status)) patch.status = "pending";
    } else if (previousStatus !== evaluation.largeGroupStatus) {
      patch.large_group_status = evaluation.largeGroupStatus;
    }
  } else if (current.requires_manual_approval || previousStatus) {
    // Shrunk back below the approval thresholds before any decision was taken.
    patch.requires_manual_approval = false;
    patch.large_group_status = null;
    if (current.status === "pending") patch.status = "confirmed";
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
