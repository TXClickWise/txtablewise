import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, toolError } from "../identity";

export default defineTool({
  name: "list_reservations",
  title: "List reservations",
  description:
    "List reservations for a date (or date range) for a restaurant, ordered by start time. Cancelled reservations are excluded unless include_cancelled is true.",
  inputSchema: {
    date: z.string().describe("Date in YYYY-MM-DD. Defaults to today."),
    end_date: z.string().optional().describe("Optional end date (YYYY-MM-DD) for a range."),
    restaurant_id: z.string().optional().describe("Restaurant id; optional when the user has one restaurant."),
    include_cancelled: z.boolean().optional(),
    limit: z.number().optional().describe("Max rows to return, default 100."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date, end_date, restaurant_id, include_cancelled, limit }, ctx) => {
    try {
      const { restaurantId: rid, sb } = await authorize(ctx, "reservation.read", restaurant_id);
      const from = date || new Date().toISOString().slice(0, 10);
      const to = end_date || from;
      const cap = Math.min(Math.max(limit ?? 100, 1), 200);
      let q = sb
        .from("reservations")
        .select(
          "id, reservation_date, start_time, end_time, party_size, status, channel, guest_first_name, guest_last_name, guest_phone, guest_email, special_requests, dietary_notes, large_group_status, requires_manual_approval",
        )
        .eq("restaurant_id", rid)
        .gte("reservation_date", from)
        .lte("reservation_date", to)
        .order("start_time", { ascending: true })
        .limit(cap);
      if (!include_cancelled) q = q.neq("status", "cancelled");
      const { data, error } = await q;
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      return {
        content: [{ type: "text", text: JSON.stringify(data ?? []) }],
        structuredContent: { restaurant_id: rid, reservations: data ?? [] },
      };
    } catch (e) {
      return toolError(e);
    }
  },
});
