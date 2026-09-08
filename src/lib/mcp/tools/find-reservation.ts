import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, toolError, toolResult, McpError } from "../identity";

/**
 * Finds an existing reservation without needing its id, so a voice agent can
 * identify the right booking before changing or cancelling it. Returns only the
 * minimum needed to confirm identity with the guest — never a full day list.
 */
export default defineTool({
  name: "find_reservation",
  title: "Find reservation",
  description:
    "Find an active reservation by confirmation code, phone, email, or name plus date. Returns at most 5 minimal matches. Use this before update_reservation or cancel_reservation when you do not have a reservation id.",
  inputSchema: {
    confirmation_code: z.string().optional().describe("Confirmation code given to the guest."),
    phone: z.string().optional(),
    email: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    date: z.string().optional().describe("Reservation date in YYYY-MM-DD."),
    restaurant_id: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    try {
      const { restaurantId, sb } = await authorize(ctx, "reservation.read", input.restaurant_id);
      const code = (input.confirmation_code ?? "").trim().toUpperCase();
      const phone = (input.phone ?? "").replace(/\s+/g, "");
      const email = (input.email ?? "").trim();
      const first = (input.first_name ?? "").trim();
      const last = (input.last_name ?? "").trim();
      const date = (input.date ?? "").trim();

      const hasIdentifier = !!code || phone.length >= 6 || !!email || !!last || (!!first && !!date);
      if (!hasIdentifier) {
        throw new McpError(
          "missing_field",
          "Geef een bevestigingscode, telefoonnummer, e-mailadres, achternaam of voornaam met datum.",
        );
      }

      const cols =
        "id, reservation_date, start_time, party_size, status, guest_first_name, guest_last_name, requires_manual_approval, large_group_status";
      const active = ["pending", "confirmed", "seated", "hold"];

      if (code) {
        const { data, error } = await sb
          .from("reservations")
          .select(cols)
          .eq("restaurant_id", restaurantId)
          .eq("confirmation_code", code)
          .in("status", active)
          .limit(1);
        if (error) throw new McpError("internal", error.message);
        if (data && data.length > 0) {
          return toolResult({ ok: true, restaurant_id: restaurantId, matches: data });
        }
      }

      let q = sb
        .from("reservations")
        .select(cols)
        .eq("restaurant_id", restaurantId)
        .in("status", active)
        .order("start_time", { ascending: true })
        .limit(5);

      if (date) q = q.eq("reservation_date", date);
      else q = q.gte("start_time", new Date().toISOString());

      if (phone.length >= 6) q = q.ilike("guest_phone", `%${phone.slice(-8)}%`);
      else if (email) q = q.ilike("guest_email", `%${email}%`);
      else {
        if (last) q = q.ilike("guest_last_name", `%${last}%`);
        if (first) q = q.ilike("guest_first_name", `%${first}%`);
      }

      const { data, error } = await q;
      if (error) throw new McpError("internal", error.message);
      return toolResult({ ok: true, restaurant_id: restaurantId, matches: data ?? [] });
    } catch (e) {
      return toolError(e);
    }
  },
});
