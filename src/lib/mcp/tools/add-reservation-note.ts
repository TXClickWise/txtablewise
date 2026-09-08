import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { assertReservationTenant, authorize, toolError, toolResult, McpError } from "../identity";

export default defineTool({
  name: "add_reservation_note",
  title: "Add internal note to reservation",
  description:
    "Append an internal note to a reservation. Internal notes are only visible to staff, never to the guest. Staff action — not available to guest-facing agents.",
  inputSchema: {
    reservation_id: z.string().describe("Reservation id (uuid)."),
    note: z.string().describe("The note to append."),
    restaurant_id: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ reservation_id, note, restaurant_id }, ctx) => {
    try {
      const { restaurantId, sb } = await authorize(ctx, "reservation.note.write", restaurant_id);
      const text = note.trim();
      if (!text) throw new McpError("missing_field", "Notitie mag niet leeg zijn.");
      await assertReservationTenant(sb, reservation_id, restaurantId);

      const { data: current, error: readErr } = await sb
        .from("reservations")
        .select("id, internal_notes")
        .eq("id", reservation_id)
        .maybeSingle();
      if (readErr) throw new Error(readErr.message);
      if (!current) throw new McpError("not_found", "Reservering niet gevonden.");

      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const merged = [current.internal_notes?.trim(), `[${stamp}] ${text}`].filter(Boolean).join("\n");
      const { data, error } = await sb
        .from("reservations")
        .update({ internal_notes: merged })
        .eq("id", reservation_id)
        .select("id, internal_notes")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return toolResult({ ok: true, reservation: data });
    } catch (e) {
      return toolError(e);
    }
  },
});
