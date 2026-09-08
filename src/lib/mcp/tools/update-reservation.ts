import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { assertReservationTenant, authorize, toolError, toolResult, McpError } from "../identity";
import { callEngine } from "../supabase";

export default defineTool({
  name: "update_reservation",
  title: "Update reservation",
  description:
    "Change the date, time, party size or notes of an existing reservation through the TableWise engine. Read the new date, time and party size back to the guest and get an explicit yes before calling this (confirmed must be true). If the group becomes large, the reservation can go back to pending approval — report the returned status truthfully.",
  inputSchema: {
    reservation_id: z.string(),
    confirmed: z.boolean().describe("Must be true: the guest explicitly confirmed the change."),
    date: z.string().optional().describe("New date YYYY-MM-DD."),
    time: z.string().optional().describe("New local time HH:MM."),
    party_size: z.number().optional(),
    special_requests: z.string().optional(),
    restaurant_id: z.string().optional(),
    table_ids: z.array(z.string()).optional().describe("Staff override only; requires table.override."),
    combination_id: z.string().optional().describe("Staff override only; requires table.override."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    try {
      const { restaurantId, identity, sb } = await authorize(ctx, "reservation.update", input.restaurant_id);
      if (input.confirmed !== true) {
        throw new McpError("confirmation_required", "Bevestig de wijziging eerst expliciet met de gast.");
      }
      await assertReservationTenant(sb, input.reservation_id, restaurantId);

      const wantsOverride = (input.table_ids?.length ?? 0) > 0 || !!input.combination_id;
      if (wantsOverride && !identity.capabilities.includes("table.override")) {
        throw new McpError("capability_denied", "Tafels kiezen mag alleen door bevoegd personeel.");
      }

      const payload: Record<string, unknown> = {
        action: "update",
        reservation_id: input.reservation_id,
      };
      if (input.date) payload.reservation_date = input.date;
      if (input.time) payload.start_time_local = input.time;
      if (input.party_size !== undefined) payload.party_size = input.party_size;
      if (input.special_requests !== undefined) payload.special_requests = input.special_requests;
      if (wantsOverride) {
        if (input.table_ids?.length) payload.table_ids = input.table_ids;
        if (input.combination_id) payload.combination_id = input.combination_id;
      }

      const r = await callEngine("manage_reservation", payload, identity.token);
      if (r.status >= 400 || r.body.error) {
        return toolResult({
          ok: false,
          error_code: r.body.reason_code ?? "update_failed",
          error: r.body.error ?? "De wijziging is niet doorgevoerd.",
        });
      }
      const reservation = (r.body.reservation ?? {}) as Record<string, unknown>;
      return toolResult({
        ok: true,
        restaurant_id: restaurantId,
        reservation,
        status: reservation.status ?? null,
        requires_manual_approval: reservation.requires_manual_approval ?? false,
        large_group_status: reservation.large_group_status ?? null,
      });
    } catch (e) {
      return toolError(e);
    }
  },
});
