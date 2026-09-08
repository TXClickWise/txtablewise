import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, toolError } from "../identity";

export default defineTool({
  name: "list_waitlist",
  title: "List waitlist",
  description: "List waitlist entries for a date, with party size, desired time window and status.",
  inputSchema: {
    date: z.string().describe("Desired date in YYYY-MM-DD. Defaults to today."),
    restaurant_id: z.string().optional().describe("Restaurant id; optional when the user has one restaurant."),
    status: z.string().optional().describe("Optional status filter, e.g. waiting, notified, converted."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date, restaurant_id, status }, ctx) => {
    try {
      const { restaurantId: rid, sb } = await authorize(ctx, "waitlist.read", restaurant_id);
      const day = date || new Date().toISOString().slice(0, 10);
      let q = sb
        .from("waitlist_entries")
        .select(
          "id, desired_date, desired_time_from, desired_time_to, party_size, first_name, last_name, phone, email, status, notes, notified_at, matched_at, created_at",
        )
        .eq("restaurant_id", rid)
        .eq("desired_date", day)
        .order("created_at", { ascending: true })
        .limit(100);
      if (status) q = q.eq("status", status as never);
      const { data, error } = await q;
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      return {
        content: [{ type: "text", text: JSON.stringify(data ?? []) }],
        structuredContent: { restaurant_id: rid, entries: data ?? [] },
      };
    } catch (e) {
      return toolError(e);
    }
  },
});
