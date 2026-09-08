import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, assertReservationTenant, toolError } from "../identity";

export default defineTool({
  name: "get_reservation",
  title: "Get reservation",
  description: "Get the full details of one reservation by its id.",
  inputSchema: { reservation_id: z.string().describe("Reservation id (uuid).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ reservation_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("reservations")
      .select(
        "id, restaurant_id, reservation_date, start_time, end_time, party_size, status, channel, source_label, confirmation_code, guest_id, guest_first_name, guest_last_name, guest_email, guest_phone, guest_language, special_requests, dietary_notes, internal_notes, occasion, prefers_terrace, requires_manual_approval, large_group_status, deposit_required, deposit_status, no_show_risk, created_at, updated_at",
      )
      .eq("id", reservation_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Reservering niet gevonden." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { reservation: data },
    };
  },
});
