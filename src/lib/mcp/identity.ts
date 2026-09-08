// Identity, tenant binding and capability enforcement for the TX TableWise MCP server.
//
// Two identity kinds share one server:
//  1. Human OAuth  — a staff member connects their own assistant. Tenant = their
//     memberships, capabilities derived from their role.
//  2. Service identity — a machine account (HighLevel Voice AI, Managed Agent,
//     Workflow agent, automation) that is hard-bound to ONE restaurant with an
//     explicit capability list stored in `mcp_service_identities`.
//
// Every write path calls `requireCapability()` and `assertTenant()` BEFORE any
// TableWise engine is invoked. MCP annotations are hints only, never security.

import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser, type Sb } from "./supabase";

export type Capability =
  | "availability.read"
  | "reservation.read"
  | "reservation.create"
  | "reservation.update"
  | "reservation.cancel"
  | "reservation.status.write"
  | "waitlist.read"
  | "waitlist.create"
  | "guest.search"
  | "reservation.note.write"
  | "large_group.approve"
  | "large_group.decline"
  | "table.override"
  | "deposit.read";

export type ServiceProfile =
  | "guest_voice"
  | "guest_conversation"
  | "workflow_agent"
  | "operations_agent"
  | "manager_agent"
  | "revenue_agent"
  | "system_automation";

/** Hard ceiling per profile — a stored capability outside this set is ignored. */
const PROFILE_CEILING: Record<ServiceProfile, Capability[]> = {
  guest_voice: [
    "availability.read", "reservation.read", "reservation.create",
    "reservation.update", "reservation.cancel", "waitlist.create",
  ],
  guest_conversation: [
    "availability.read", "reservation.read", "reservation.create",
    "reservation.update", "reservation.cancel", "waitlist.create",
  ],
  workflow_agent: [
    "availability.read", "reservation.read", "reservation.create",
    "reservation.update", "reservation.cancel", "reservation.status.write",
    "waitlist.read", "waitlist.create", "guest.search", "reservation.note.write",
  ],
  operations_agent: [
    "availability.read", "reservation.read", "reservation.update",
    "reservation.status.write", "waitlist.read", "waitlist.create",
    "guest.search", "reservation.note.write", "deposit.read",
  ],
  manager_agent: [
    "availability.read", "reservation.read", "reservation.create",
    "reservation.update", "reservation.cancel", "reservation.status.write",
    "waitlist.read", "waitlist.create", "guest.search", "reservation.note.write",
    "large_group.approve", "large_group.decline", "table.override", "deposit.read",
  ],
  revenue_agent: ["availability.read", "reservation.read", "waitlist.read", "deposit.read"],
  system_automation: [
    "availability.read", "reservation.read", "reservation.status.write",
    "waitlist.read", "reservation.note.write",
  ],
};

const MANAGER_CAPABILITIES: Capability[] = [
  "availability.read", "reservation.read", "reservation.create", "reservation.update",
  "reservation.cancel", "reservation.status.write", "waitlist.read", "waitlist.create",
  "guest.search", "reservation.note.write", "large_group.approve", "large_group.decline",
  "table.override", "deposit.read",
];

const STAFF_CAPABILITIES: Capability[] = [
  "availability.read", "reservation.read", "reservation.create", "reservation.update",
  "reservation.cancel", "reservation.status.write", "waitlist.read", "waitlist.create",
  "guest.search", "reservation.note.write", "deposit.read",
];

export type Identity = {
  kind: "human" | "service";
  userId: string;
  profile: ServiceProfile | null;
  /** Hard tenant binding for service identities; null for humans (resolved per call). */
  boundRestaurantId: string | null;
  capabilities: Capability[];
  sb: Sb;
  token: string;
};

export class McpError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Resolves the caller: service identity when a (non-revoked) row exists, else human. */
export async function resolveIdentity(ctx: ToolContext): Promise<Identity> {
  if (!ctx.isAuthenticated()) throw new McpError("unauthenticated", "Niet geauthenticeerd.");
  const token = ctx.getToken();
  if (!token) throw new McpError("unauthenticated", "Geen geldig token.");
  const userId = ctx.getUserId() ?? "";
  const sb = supabaseForUser(ctx);

  const { data: svc } = await sb
    .from("mcp_service_identities")
    .select("restaurant_id, profile, capabilities, revoked_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (svc) {
    const profile = svc.profile as ServiceProfile;
    const ceiling = PROFILE_CEILING[profile] ?? [];
    const granted = ((svc.capabilities ?? []) as string[])
      .filter((c): c is Capability => (ceiling as string[]).includes(c));
    return {
      kind: "service",
      userId,
      profile,
      boundRestaurantId: svc.restaurant_id as string,
      capabilities: granted,
      sb,
      token,
    };
  }

  return { kind: "human", userId, profile: null, boundRestaurantId: null, capabilities: [], sb, token };
}

/** Capabilities of a human caller for one restaurant, derived from their role. */
async function humanCapabilities(identity: Identity, restaurantId: string): Promise<Capability[]> {
  const { data } = await identity.sb
    .from("restaurant_members")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", identity.userId)
    .maybeSingle();
  if (!data) return [];
  return ["owner", "manager"].includes(data.role as string) ? MANAGER_CAPABILITIES : STAFF_CAPABILITIES;
}

/**
 * Resolves the tenant and enforces the capability in one step.
 * Service identities can never operate outside their bound restaurant.
 */
export async function authorize(
  ctx: ToolContext,
  capability: Capability,
  explicitRestaurantId?: string,
): Promise<{ identity: Identity; restaurantId: string; sb: Sb }> {
  const identity = await resolveIdentity(ctx);

  let restaurantId: string;
  if (identity.kind === "service") {
    const bound = identity.boundRestaurantId!;
    if (explicitRestaurantId && explicitRestaurantId !== bound) {
      throw new McpError("tenant_mismatch", "Deze koppeling heeft geen toegang tot dit restaurant.");
    }
    restaurantId = bound;
    if (!identity.capabilities.includes(capability)) {
      throw new McpError("capability_denied", `Deze koppeling mag '${capability}' niet uitvoeren.`);
    }
  } else {
    restaurantId = explicitRestaurantId ?? (await onlyMembership(identity));
    const caps = await humanCapabilities(identity, restaurantId);
    if (caps.length === 0) {
      throw new McpError("tenant_mismatch", "Geen toegang tot dit restaurant.");
    }
    if (!caps.includes(capability)) {
      throw new McpError("capability_denied", `Je rol mag '${capability}' niet uitvoeren.`);
    }
    identity.capabilities = caps;
  }

  return { identity, restaurantId, sb: identity.sb };
}

async function onlyMembership(identity: Identity): Promise<string> {
  const { data, error } = await identity.sb
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", identity.userId)
    .limit(5);
  if (error) throw new McpError("internal", error.message);
  const ids = Array.from(new Set((data ?? []).map((r) => r.restaurant_id as string)));
  if (ids.length === 0) throw new McpError("tenant_mismatch", "Geen restaurant gevonden voor dit account.");
  if (ids.length > 1) {
    throw new McpError("restaurant_required", "Meerdere restaurants — geef restaurant_id mee (zie list_restaurants).");
  }
  return ids[0];
}

/** Extra check: the reservation must belong to the resolved tenant. */
export async function assertReservationTenant(
  sb: Sb,
  reservationId: string,
  restaurantId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await sb
    .from("reservations")
    .select("id, restaurant_id, status, party_size, reservation_date, start_time, requires_manual_approval, large_group_status")
    .eq("id", reservationId)
    .maybeSingle();
  if (error) throw new McpError("internal", error.message);
  // Do not confirm existence of reservations in another tenant.
  if (!data || data.restaurant_id !== restaurantId) {
    throw new McpError("not_found", "Reservering niet gevonden.");
  }
  return data as Record<string, unknown>;
}

/** Uniform error payload so a voice agent can react on the code, not on prose. */
export function toolError(e: unknown) {
  const code = e instanceof McpError ? e.code : "internal";
  const message = e instanceof Error ? e.message : String(e);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error_code: code, error: message }) }],
    structuredContent: { ok: false, error_code: code, error: message } as Record<string, never>,
    isError: true,
  };
}

export function toolResult(payload: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    // The SDK types structuredContent as a JSON value; the payload is JSON-safe.
    structuredContent: JSON.parse(JSON.stringify(payload)) as Record<string, never>,
  };
}
