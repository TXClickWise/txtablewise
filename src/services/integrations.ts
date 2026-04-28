// Integratiehub service: webhook_endpoints CRUD + test-aanroepen via integration_test edge function.
import { supabase } from "@/integrations/supabase/client";

export type WebhookEvent =
  | "reservation.created" | "reservation.updated" | "reservation.cancelled"
  | "reservation.no_show" | "reservation.seated" | "reservation.completed"
  | "guest.created" | "guest.updated"
  | "waitlist.created" | "review.received";

export const WEBHOOK_EVENTS: { value: WebhookEvent; label: string }[] = [
  { value: "reservation.created", label: "Reservering aangemaakt" },
  { value: "reservation.updated", label: "Reservering gewijzigd" },
  { value: "reservation.cancelled", label: "Reservering geannuleerd" },
  { value: "reservation.no_show", label: "No-show gemarkeerd" },
  { value: "reservation.seated", label: "Gast aan tafel" },
  { value: "reservation.completed", label: "Bezoek afgerond" },
  { value: "guest.created", label: "Nieuwe gast" },
  { value: "guest.updated", label: "Gast bijgewerkt" },
  { value: "waitlist.created", label: "Wachtlijst-aanmelding" },
  { value: "review.received", label: "Review ontvangen" },
];

export type WebhookEndpoint = {
  id: string;
  restaurant_id: string;
  label: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
  last_test_response_code: number | null;
  last_test_response_body: string | null;
  created_at: string;
  updated_at: string;
};

export async function listWebhookEndpoints(restaurantId: string): Promise<WebhookEndpoint[]> {
  const { data, error } = await supabase
    .from("webhook_endpoints" as never)
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as WebhookEndpoint[];
}

export async function createWebhookEndpoint(input: {
  restaurant_id: string; label: string; url: string; secret?: string | null; events: string[];
}) {
  const { error } = await supabase.from("webhook_endpoints" as never).insert({
    restaurant_id: input.restaurant_id,
    label: input.label,
    url: input.url,
    secret: input.secret || null,
    events: input.events.length ? input.events : ["*"],
    is_active: true,
  } as never);
  if (error) throw error;
}

export async function updateWebhookEndpoint(id: string, patch: Partial<Pick<WebhookEndpoint, "label"|"url"|"secret"|"events"|"is_active">>) {
  const { error } = await supabase.from("webhook_endpoints" as never).update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteWebhookEndpoint(id: string) {
  const { error } = await supabase.from("webhook_endpoints" as never).delete().eq("id", id);
  if (error) throw error;
}

// ----- Test calls (via integration_test edge function) -----

type TestResult = { ok: boolean; status?: number; response?: unknown; response_body?: string; error?: string; sent_payload?: unknown };

export async function testWebhook(endpointId: string, eventType?: WebhookEvent): Promise<TestResult> {
  const { data, error } = await supabase.functions.invoke("integration_test/webhook", {
    body: { endpoint_id: endpointId, event_type: eventType },
  });
  if (error) return { ok: false, error: error.message };
  return data as TestResult;
}

export async function testAvailability(restaurantId: string, date: string, party_size: number): Promise<TestResult> {
  const { data, error } = await supabase.functions.invoke("integration_test/availability", {
    body: { restaurant_id: restaurantId, date, party_size },
  });
  if (error) return { ok: false, error: error.message };
  return data as TestResult;
}

export async function testBook(restaurantId: string, body: {
  date: string; time: string; party_size: number;
  guest: { first_name: string; last_name?: string; phone?: string; email?: string };
  special_requests?: string;
}): Promise<TestResult> {
  const { data, error } = await supabase.functions.invoke("integration_test/book", {
    body: { restaurant_id: restaurantId, ...body },
  });
  if (error) return { ok: false, error: error.message };
  return data as TestResult;
}
