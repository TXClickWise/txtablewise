import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, toolError, toolResult, McpError } from "../identity";
import { callEngine } from "../supabase";

/**
 * Creates a reservation through the existing booking engine (book_reservation).
 * All rules — opening hours, closures, pacing, zone fill strategy, table
 * combinations, large-group approval, lead time and horizon — stay in that engine.
 */
export default defineTool({
  name: "create_reservation",
  title: "Create reservation",
  description:
    "Create a reservation. TableWise picks the table itself. Large groups may come back as pending approval instead of confirmed — always tell the guest exactly what status you got back, never say 'confirmed' when requires_manual_approval is true. Pass a stable idempotency_key so a retry never creates a second booking.",
  inputSchema: {
    date: z.string().describe("Date in YYYY-MM-DD."),
    time: z.string().describe("Local time HH:MM."),
    party_size: z.number(),
    first_name: z.string().describe("Ask the guest for their real first name; never invent one."),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    language: z.string().optional().describe("nl, en, de or fr."),
    special_requests: z.string().optional(),
    dietary_notes: z.string().optional(),
    occasion: z.string().optional(),
    prefers_terrace: z.boolean().optional(),
    idempotency_key: z.string().optional().describe("Same key on a retry returns the original reservation."),
    restaurant_id: z.string().optional(),
    table_ids: z.array(z.string()).optional().describe("Staff override only; requires the table.override capability."),
    combination_id: z.string().optional().describe("Staff override only; requires the table.override capability."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    try {
      const { restaurantId, identity } = await authorize(ctx, "reservation.create", input.restaurant_id);

      const wantsOverride = (input.table_ids?.length ?? 0) > 0 || !!input.combination_id;
      if (wantsOverride && !identity.capabilities.includes("table.override")) {
        throw new McpError("capability_denied", "Tafels kiezen mag alleen door bevoegd personeel; TableWise kiest zelf een tafel.");
      }
      if (!input.phone && !input.email) {
        throw new McpError("missing_field", "Geef een telefoonnummer of e-mailadres van de gast.");
      }

      const engineBody: Record<string, unknown> = {
        restaurant_id: restaurantId,
        date: input.date,
        time: input.time,
        party_size: input.party_size,
        guest: {
          first_name: input.first_name,
          last_name: input.last_name,
          phone: input.phone,
          email: input.email,
          language: input.language,
        },
        special_requests: input.special_requests,
        dietary_notes: input.dietary_notes,
        occasion: input.occasion,
        prefers_terrace: input.prefers_terrace,
        idempotency_key: input.idempotency_key,
        channel: identity.profile === "guest_voice" ? "ai_host" : "manager",
        source_metadata: { via: "mcp", profile: identity.profile ?? "human" },
      };
      if (wantsOverride) {
        if (input.table_ids?.length) engineBody.preselected_table_ids = input.table_ids;
        if (input.combination_id) engineBody.preselected_combination_id = input.combination_id;
      }

      const r = await callEngine("book_reservation", engineBody, identity.token);
      if (r.status >= 400 || r.body.error) {
        return toolResult({
          ok: false,
          error_code: r.body.error_code ?? "booking_failed",
          error: r.body.error ?? "De reservering kon niet worden gemaakt.",
          large_group: r.body.large_group ?? false,
          field: r.body.field ?? null,
        });
      }
      return toolResult({ ok: true, restaurant_id: restaurantId, ...r.body });
    } catch (e) {
      return toolError(e);
    }
  },
});
