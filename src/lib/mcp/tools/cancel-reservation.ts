import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { assertReservationTenant, authorize, toolError, toolResult, McpError } from "../identity";
import { callEngine } from "../supabase";

export default defineTool({
  name: "cancel_reservation",
  title: "Cancel reservation",
  description:
    "Cancel a reservation. Irreversible. Read the guest name, date, time and party size back and get an explicit spoken yes first: confirmed must be true and a reason is required.",
  inputSchema: {
    reservation_id: z.string(),
    reason: z.string().describe("Reason for the cancellation."),
    confirmed: z.boolean().describe("Must be true: the guest explicitly confirmed the cancellation."),
    restaurant_id: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ reservation_id, reason, confirmed, restaurant_id }, ctx) => {
    try {
      const { restaurantId, identity, sb } = await authorize(ctx, "reservation.cancel", restaurant_id);
      if (confirmed !== true) {
        throw new McpError("confirmation_required", "Bevestig de annulering eerst expliciet met de gast.");
      }
      if (!reason || !reason.trim()) {
        throw new McpError("missing_field", "Geef een reden voor de annulering.");
      }
      await assertReservationTenant(sb, reservation_id, restaurantId);

      const r = await callEngine(
        "manage_reservation",
        { action: "cancel", reservation_id, cancellation_reason: reason.trim() },
        identity.token,
      );
      if (r.status >= 400 || r.body.error) {
        return toolResult({
          ok: false,
          error_code: r.body.reason_code ?? "cancel_failed",
          error: r.body.error ?? "De annulering is niet doorgevoerd.",
        });
      }
      return toolResult({ ok: true, restaurant_id: restaurantId, reservation: r.body.reservation ?? null, status: "cancelled" });
    } catch (e) {
      return toolError(e);
    }
  },
});
