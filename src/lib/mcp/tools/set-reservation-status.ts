import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { assertReservationTenant, authorize, toolError, toolResult, McpError } from "../identity";
import { callEngine } from "../supabase";

const ALLOWED = ["confirmed", "seated", "completed", "no_show"] as const;

export default defineTool({
  name: "set_reservation_status",
  title: "Set reservation status",
  description:
    "Set the operational status of a reservation: confirmed, seated, completed or no_show. Staff action — not available to guest-facing agents. Use cancel_reservation to cancel.",
  inputSchema: {
    reservation_id: z.string(),
    status: z.string().describe("One of: confirmed, seated, completed, no_show."),
    restaurant_id: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ reservation_id, status, restaurant_id }, ctx) => {
    try {
      const { restaurantId, identity, sb } = await authorize(ctx, "reservation.status.write", restaurant_id);
      if (!(ALLOWED as readonly string[]).includes(status)) {
        throw new McpError("invalid_input", `Onbekende status. Kies uit: ${ALLOWED.join(", ")}.`);
      }
      await assertReservationTenant(sb, reservation_id, restaurantId);

      const r = await callEngine(
        "manage_reservation",
        { action: "change_status", reservation_id, new_status: status },
        identity.token,
      );
      if (r.status >= 400 || r.body.error) {
        return toolResult({
          ok: false,
          error_code: r.body.reason_code ?? "status_change_failed",
          error: r.body.error ?? "De status is niet gewijzigd.",
        });
      }
      return toolResult({ ok: true, restaurant_id: restaurantId, reservation: r.body.reservation ?? null });
    } catch (e) {
      return toolError(e);
    }
  },
});
