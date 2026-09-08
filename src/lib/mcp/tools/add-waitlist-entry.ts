import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, toolError, toolResult, McpError } from "../identity";

export default defineTool({
  name: "add_waitlist_entry",
  title: "Add guest to the waitlist",
  description:
    "Put a guest on the waitlist when nothing is available at the requested time. The restaurant contacts the guest when a table frees up.",
  inputSchema: {
    date: z.string().describe("Desired date YYYY-MM-DD."),
    time_from: z.string().describe("Earliest acceptable local time HH:MM."),
    time_to: z.string().optional().describe("Latest acceptable local time HH:MM."),
    party_size: z.number(),
    first_name: z.string(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    notes: z.string().optional(),
    restaurant_id: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    try {
      const { restaurantId, sb } = await authorize(ctx, "waitlist.create", input.restaurant_id);
      if (!input.phone && !input.email) {
        throw new McpError("missing_field", "Geef een telefoonnummer of e-mailadres zodat we de gast kunnen bereiken.");
      }
      const { data, error } = await sb
        .from("waitlist_entries")
        .insert({
          restaurant_id: restaurantId,
          desired_date: input.date,
          desired_time_from: input.time_from,
          desired_time_to: input.time_to ?? input.time_from,
          party_size: input.party_size,
          first_name: input.first_name,
          last_name: input.last_name ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          notes: input.notes ?? null,
          status: "waiting",
        })
        .select("id, desired_date, desired_time_from, desired_time_to, party_size, status")
        .single();
      if (error) throw new McpError("waitlist_failed", error.message);
      return toolResult({ ok: true, restaurant_id: restaurantId, entry: data });
    } catch (e) {
      return toolError(e);
    }
  },
});
