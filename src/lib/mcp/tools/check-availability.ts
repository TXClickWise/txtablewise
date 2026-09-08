import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, toolError, toolResult } from "../identity";
import { callEngine } from "../supabase";

export default defineTool({
  name: "check_availability",
  title: "Check availability",
  description:
    "Check which times are still available for a date and party size. Uses the restaurant's own opening hours, closures, pacing, zones and table combinations. Always call this before creating a reservation.",
  inputSchema: {
    date: z.string().describe("Date in YYYY-MM-DD."),
    party_size: z.number().describe("Number of guests."),
    restaurant_id: z.string().optional().describe("Only for users with more than one restaurant."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date, party_size, restaurant_id }, ctx) => {
    try {
      const { restaurantId, identity } = await authorize(ctx, "availability.read", restaurant_id);
      const r = await callEngine("availability", { restaurant_id: restaurantId, date, party_size }, identity.token);
      if (r.status >= 400) {
        return toolError(new Error(String(r.body.error ?? "Beschikbaarheid kon niet worden opgehaald.")));
      }
      return toolResult({ ok: true, restaurant_id: restaurantId, ...r.body });
    } catch (e) {
      return toolError(e);
    }
  },
});
