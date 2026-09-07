import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_reservation_note",
  title: "Add internal note to reservation",
  description:
    "Append an internal note to a reservation. Internal notes are only visible to staff, never to the guest.",
  inputSchema: {
    reservation_id: z.string().describe("Reservation id (uuid)."),
    note: z.string().describe("The note to append."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ reservation_id, note }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const text = note.trim();
    if (!text) return { content: [{ type: "text", text: "Notitie mag niet leeg zijn." }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data: current, error: readErr } = await sb
      .from("reservations")
      .select("id, internal_notes")
      .eq("id", reservation_id)
      .maybeSingle();
    if (readErr) return { content: [{ type: "text", text: readErr.message }], isError: true };
    if (!current) return { content: [{ type: "text", text: "Reservering niet gevonden." }], isError: true };

    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const merged = [current.internal_notes?.trim(), `[${stamp}] ${text}`].filter(Boolean).join("\n");
    const { data, error } = await sb
      .from("reservations")
      .update({ internal_notes: merged })
      .eq("id", reservation_id)
      .select("id, internal_notes")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { reservation: data },
    };
  },
});
