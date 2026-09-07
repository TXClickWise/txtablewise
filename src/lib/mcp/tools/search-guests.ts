import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveRestaurantId, supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_guests",
  title: "Search guests",
  description: "Search the guest book by name, email or phone. Returns visit history, VIP flag and allergies.",
  inputSchema: {
    query: z.string().describe("Name, email or phone fragment to search for."),
    restaurant_id: z.string().optional().describe("Restaurant id; optional when the user has one restaurant."),
    limit: z.number().optional().describe("Max rows, default 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, restaurant_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    try {
      const rid = await resolveRestaurantId(sb, restaurant_id);
      const cap = Math.min(Math.max(limit ?? 20, 1), 50);
      const term = query.trim().replace(/[%,]/g, " ");
      const { data, error } = await sb
        .from("guests")
        .select(
          "id, first_name, last_name, full_name, email, phone, is_vip, is_blacklisted, allergies, dietary_preferences, seating_preferences, hospitality_notes, total_visits, no_show_count, last_visit_at, tags",
        )
        .eq("restaurant_id", rid)
        .is("deleted_at", null)
        .or(
          `full_name.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
        )
        .order("last_visit_at", { ascending: false, nullsFirst: false })
        .limit(cap);
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      return {
        content: [{ type: "text", text: JSON.stringify(data ?? []) }],
        structuredContent: { restaurant_id: rid, guests: data ?? [] },
      };
    } catch (e) {
      return { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true };
    }
  },
});
