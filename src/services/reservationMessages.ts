// Helper to request a guest message via ClickWise/integration_events.
// Does NOT send a message itself — TableWise queues the event and the
// configured channel (ClickWise) handles delivery.
import { supabase } from "@/integrations/supabase/client";

export type GuestMessageKind = "custom" | "reminder" | "reconfirmation" | "running_late";

export async function requestGuestMessage(params: {
  restaurantId: string;
  reservationId: string;
  guestId?: string | null;
  kind?: GuestMessageKind;
  message?: string;
}) {
  const { restaurantId, reservationId, guestId, kind = "custom", message } = params;
  const { error } = await supabase.from("integration_events").insert({
    restaurant_id: restaurantId,
    event_type: "guest_message_requested",
    entity_type: "reservation",
    entity_id: reservationId,
    payload: {
      reservation_id: reservationId,
      guest_id: guestId ?? null,
      kind,
      message: message ?? null,
    },
    metadata: { source: "reservations_quick_action" },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
