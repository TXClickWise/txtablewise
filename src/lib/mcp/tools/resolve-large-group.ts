import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { assertReservationTenant, authorize, toolError, toolResult, McpError } from "../identity";
import { callEngine } from "../supabase";

export default defineTool({
  name: "resolve_large_group",
  title: "Approve or decline a large group request",
  description:
    "Approve or decline a large group reservation that is waiting for manual approval. Management action — never available to guest-facing agents. Requires explicit confirmation.",
  inputSchema: {
    reservation_id: z.string(),
    decision: z.string().describe("approve or decline."),
    confirmed: z.boolean().describe("Must be true: the decision was explicitly confirmed."),
    reason: z.string().optional().describe("Reason, required when declining."),
    restaurant_id: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ reservation_id, decision, confirmed, reason, restaurant_id }, ctx) => {
    try {
      const approve = decision === "approve";
      if (!approve && decision !== "decline") {
        throw new McpError("invalid_input", "Kies 'approve' of 'decline'.");
      }
      const { restaurantId, identity, sb } = await authorize(
        ctx,
        approve ? "large_group.approve" : "large_group.decline",
        restaurant_id,
      );
      if (confirmed !== true) throw new McpError("confirmation_required", "Bevestig dit besluit expliciet.");
      if (!approve && !(reason ?? "").trim()) {
        throw new McpError("missing_field", "Geef een reden bij het afwijzen.");
      }
      await assertReservationTenant(sb, reservation_id, restaurantId);

      const r = await callEngine(
        "manage_reservation",
        {
          action: approve ? "approve_large_group" : "decline_large_group",
          reservation_id,
          cancellation_reason: reason,
        },
        identity.token,
      );
      if (r.status >= 400 || r.body.error) {
        return toolResult({
          ok: false,
          error_code: r.body.reason_code ?? "large_group_decision_failed",
          error: r.body.error ?? "Het besluit is niet verwerkt.",
        });
      }
      return toolResult({ ok: true, restaurant_id: restaurantId, decision, reservation: r.body.reservation ?? null });
    } catch (e) {
      return toolError(e);
    }
  },
});
