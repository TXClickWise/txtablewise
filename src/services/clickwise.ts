// ClickWise / HighLevel integration service.
// Geen echte externe API-call vanuit de frontend — alle uitgaande verzending gebeurt later
// via een veilige edge function. Deze service beheert configuratie, mappings, payload previews
// en de event queue.
import { supabase } from "@/integrations/supabase/client";

export type ConnectionMode = "prepared" | "test" | "live" | "error" | "disabled";
export type EventStatus = "pending" | "processing" | "sent" | "failed" | "skipped";

// ---------- Defaults ----------

export const DEFAULT_TAG_MAPPING: Record<string, { label: string; enabled: boolean; tag: string }> = {
  returning_guest:           { label: "Terugkerende gast",          enabled: true,  tag: "returning_guest" },
  vip_guest:                 { label: "VIP",                         enabled: true,  tag: "vip" },
  allergy:                   { label: "Allergie bekend",             enabled: true,  tag: "allergy" },
  dietary_preference:        { label: "Dieetwens",                   enabled: true,  tag: "dietary_preference" },
  terrace_preference:        { label: "Terrasvoorkeur",              enabled: true,  tag: "terrace_preference" },
  quiet_table_preference:    { label: "Rustige tafel",               enabled: true,  tag: "quiet_table_preference" },
  large_group_booker:        { label: "Grote groep boeker",          enabled: true,  tag: "large_group_booker" },
  walk_in_guest:             { label: "Walk-in gast",                enabled: true,  tag: "walk_in" },
  no_show_history:           { label: "No-show historie",            enabled: true,  tag: "no_show_history" },
  review_candidate:          { label: "Review kandidaat",            enabled: true,  tag: "review_candidate" },
  birthday_guest:            { label: "Verjaardag bekend",           enabled: false, tag: "birthday" },
  marketing_opt_in:          { label: "Marketing opt-in",            enabled: true,  tag: "marketing_opt_in" },
  waitlist_guest:            { label: "Wachtlijst gast",             enabled: true,  tag: "waitlist" },
  pre_order_guest:           { label: "Drankje vooraf",              enabled: true,  tag: "pre_order" },
  high_no_show_attention:    { label: "Extra bevestiging aanbevolen",enabled: true,  tag: "extra_confirmation_recommended" },
};

export type CustomFieldDef = { tableWise: string; clickWise: string; enabled: boolean; sample: string; group: string };

export const DEFAULT_CUSTOM_FIELDS: CustomFieldDef[] = [
  // Reservation
  { group: "Reservering", tableWise: "next_reservation_date",            clickWise: "next_reservation_date",            enabled: true, sample: "2026-05-01" },
  { group: "Reservering", tableWise: "next_reservation_time",            clickWise: "next_reservation_time",            enabled: true, sample: "19:00" },
  { group: "Reservering", tableWise: "next_reservation_party_size",      clickWise: "next_reservation_party_size",      enabled: true, sample: "4" },
  { group: "Reservering", tableWise: "next_reservation_status",          clickWise: "next_reservation_status",          enabled: true, sample: "confirmed" },
  { group: "Reservering", tableWise: "next_reservation_source",          clickWise: "next_reservation_source",          enabled: true, sample: "website_widget" },
  { group: "Reservering", tableWise: "next_reservation_table",           clickWise: "next_reservation_table",           enabled: false, sample: "T7" },
  { group: "Reservering", tableWise: "next_reservation_zone",            clickWise: "next_reservation_zone",            enabled: true, sample: "Terras" },
  { group: "Reservering", tableWise: "next_reservation_special_occasion",clickWise: "next_reservation_special_occasion",enabled: true, sample: "verjaardag" },
  { group: "Reservering", tableWise: "next_reservation_pre_orders",      clickWise: "next_reservation_pre_orders",      enabled: true, sample: "Prosecco x2" },
  { group: "Reservering", tableWise: "last_reservation_date",            clickWise: "last_reservation_date",            enabled: true, sample: "2026-04-01" },
  { group: "Reservering", tableWise: "last_reservation_status",          clickWise: "last_reservation_status",          enabled: true, sample: "completed" },
  { group: "Reservering", tableWise: "last_reservation_channel",         clickWise: "last_reservation_channel",         enabled: true, sample: "online" },
  // Guest
  { group: "Gast", tableWise: "visit_count",            clickWise: "visit_count",            enabled: true, sample: "3" },
  { group: "Gast", tableWise: "no_show_count",          clickWise: "no_show_count",          enabled: true, sample: "0" },
  { group: "Gast", tableWise: "preferred_channel",      clickWise: "preferred_channel",      enabled: true, sample: "whatsapp" },
  { group: "Gast", tableWise: "preferred_language",     clickWise: "preferred_language",     enabled: true, sample: "nl" },
  { group: "Gast", tableWise: "seating_preferences",    clickWise: "seating_preferences",    enabled: true, sample: "rustige hoek" },
  { group: "Gast", tableWise: "allergies",              clickWise: "allergies",              enabled: true, sample: "noten" },
  { group: "Gast", tableWise: "dietary_preferences",    clickWise: "dietary_preferences",    enabled: true, sample: "vegetarisch" },
  { group: "Gast", tableWise: "marketing_opt_in",       clickWise: "marketing_opt_in",       enabled: true, sample: "true" },
  { group: "Gast", tableWise: "is_vip",                 clickWise: "is_vip",                 enabled: true, sample: "true" },
  { group: "Gast", tableWise: "last_visit_at",          clickWise: "last_visit_at",          enabled: true, sample: "2026-04-01T19:30:00Z" },
  { group: "Gast", tableWise: "source_channel",         clickWise: "source_channel",         enabled: true, sample: "website_widget" },
  // Waitlist
  { group: "Wachtlijst", tableWise: "waitlist_status",            clickWise: "waitlist_status",            enabled: true, sample: "waiting" },
  { group: "Wachtlijst", tableWise: "waitlist_desired_date",      clickWise: "waitlist_desired_date",      enabled: true, sample: "2026-05-02" },
  { group: "Wachtlijst", tableWise: "waitlist_party_size",        clickWise: "waitlist_party_size",        enabled: true, sample: "2" },
  { group: "Wachtlijst", tableWise: "waitlist_zone_preference",   clickWise: "waitlist_zone_preference",   enabled: true, sample: "Binnen" },
  // Review
  { group: "Review", tableWise: "last_feedback_rating",   clickWise: "last_feedback_rating",   enabled: true, sample: "5" },
  { group: "Review", tableWise: "last_feedback_status",   clickWise: "last_feedback_status",   enabled: true, sample: "positive" },
  { group: "Review", tableWise: "follow_up_required",     clickWise: "follow_up_required",     enabled: true, sample: "false" },
  { group: "Review", tableWise: "google_review_invited",  clickWise: "google_review_invited",  enabled: true, sample: "true" },
];

export type WorkflowDef = { event: string; group: string; label: string; enabled: boolean; workflowName: string };

export const DEFAULT_WORKFLOWS: WorkflowDef[] = [
  // Reservation
  { group: "Reservering", event: "reservation.created",                 label: "Bevestiging reservering",        enabled: true,  workflowName: "TableWise · Bevestiging reservering" },
  { group: "Reservering", event: "reservation.updated",                 label: "Wijzigingsbevestiging",          enabled: true,  workflowName: "TableWise · Wijzigingsbevestiging" },
  { group: "Reservering", event: "reservation.cancelled",               label: "Annuleringsbevestiging",         enabled: true,  workflowName: "TableWise · Annuleringsbevestiging" },
  { group: "Reservering", event: "reservation.reminder_24h_scheduled",  label: "24-uurs reminder",               enabled: true,  workflowName: "TableWise · Reminder 24u" },
  { group: "Reservering", event: "reservation.reminder_2h_scheduled",   label: "2-uurs reminder",                enabled: true,  workflowName: "TableWise · Reminder 2u" },
  { group: "Reservering", event: "reservation.reconfirmation_requested",label: "Herbevestiging",                 enabled: true,  workflowName: "TableWise · Herbevestiging" },
  { group: "Reservering", event: "reservation.reconfirmed",             label: "Gast bevestigd",                 enabled: true,  workflowName: "TableWise · Gast bevestigd" },
  { group: "Reservering", event: "reservation.no_show",                 label: "No-show opvolging",              enabled: true,  workflowName: "TableWise · No-show opvolging" },
  { group: "Reservering", event: "reservation.completed",               label: "Aftercare starten",              enabled: true,  workflowName: "TableWise · Aftercare starten" },
  // Large group
  { group: "Grote groep", event: "large_group.requested",               label: "Groepsaanvraag ontvangen",       enabled: true,  workflowName: "TableWise · Groepsaanvraag ontvangen" },
  { group: "Grote groep", event: "large_group.approved",                label: "Groepsreservering goedgekeurd",  enabled: true,  workflowName: "TableWise · Groep goedgekeurd" },
  { group: "Grote groep", event: "large_group.declined",                label: "Groepsaanvraag afgewezen",       enabled: true,  workflowName: "TableWise · Groep afgewezen" },
  { group: "Grote groep", event: "large_group.deposit_recommended",     label: "Reserveringsgarantie aanbevolen",enabled: false, workflowName: "TableWise · Garantie aanbevolen" },
  { group: "Grote groep", event: "large_group.deposit_required",        label: "Reserveringsgarantie nodig",     enabled: false, workflowName: "TableWise · Garantie nodig" },
  // Waitlist
  { group: "Wachtlijst",  event: "waitlist.created",                    label: "Wachtlijst bevestiging",         enabled: true,  workflowName: "TableWise · Wachtlijst bevestiging" },
  { group: "Wachtlijst",  event: "waitlist.match_suggested",            label: "Mogelijke plek gevonden",        enabled: true,  workflowName: "TableWise · Wachtlijst match" },
  { group: "Wachtlijst",  event: "waitlist.notification_requested",     label: "Wachtlijstbericht",              enabled: true,  workflowName: "TableWise · Wachtlijst notificatie" },
  { group: "Wachtlijst",  event: "waitlist.converted",                  label: "Wachtlijst → reservering",       enabled: true,  workflowName: "TableWise · Wachtlijst omgezet" },
  // Pre-orders
  { group: "Drankjes vooraf", event: "pre_order.added",                 label: "Drankje toegevoegd",             enabled: false, workflowName: "TableWise · Pre-order toegevoegd" },
  { group: "Drankjes vooraf", event: "pre_order.prepared",              label: "Klaargezet",                     enabled: false, workflowName: "TableWise · Pre-order klaar" },
  { group: "Drankjes vooraf", event: "pre_order.served",                label: "Geserveerd",                     enabled: false, workflowName: "TableWise · Pre-order geserveerd" },
  // Reviews
  { group: "Reviews",     event: "review.requested",                    label: "Reviewverzoek klaarzetten",      enabled: true,  workflowName: "TableWise · Reviewverzoek" },
  { group: "Reviews",     event: "review.positive_feedback",            label: "Google Review uitnodiging",      enabled: true,  workflowName: "TableWise · Google Review uitnodiging" },
  { group: "Reviews",     event: "review.negative_feedback",            label: "Manager opvolging",              enabled: true,  workflowName: "TableWise · Manager opvolging" },
  { group: "Reviews",     event: "review.follow_up_required",           label: "Taak voor manager",              enabled: true,  workflowName: "TableWise · Manager taak" },
  // Guest
  { group: "Gast",        event: "guest.created",                       label: "Nieuwe gast",                    enabled: true,  workflowName: "TableWise · Nieuwe gast" },
  { group: "Gast",        event: "guest.updated",                       label: "Gastprofiel bijgewerkt",         enabled: false, workflowName: "TableWise · Gast bijgewerkt" },
  { group: "Gast",        event: "guest.marketing_opt_in_updated",      label: "Marketing opt-in bijgewerkt",    enabled: true,  workflowName: "TableWise · Marketing opt-in" },
];

// ---------- Settings ----------

export type ClickWiseSettings = {
  id: string;
  restaurant_id: string;
  connection_mode: ConnectionMode;
  location_id: string | null;
  api_base_url: string | null;
  sandbox_mode: boolean;
  contact_sync_enabled: boolean;
  contact_sync_rules: Record<string, unknown>;
  tag_mapping: Record<string, { label: string; enabled: boolean; tag: string }>;
  custom_field_mapping: Record<string, { clickWise: string; enabled: boolean }>;
  workflow_mapping: Record<string, { workflowName: string; enabled: boolean }>;
  privacy_options: Record<string, boolean>;
  last_test_at: string | null;
  last_error: string | null;
};

export async function getClickWiseSettings(restaurantId: string): Promise<ClickWiseSettings> {
  const { data } = await supabase
    .from("clickwise_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (data) return data as unknown as ClickWiseSettings;

  // Create default row on first access (manager only — RLS will reject staff)
  const { data: created, error } = await supabase
    .from("clickwise_settings")
    .insert([{ restaurant_id: restaurantId }])
    .select("*")
    .single();
  if (error) throw error;
  return created as unknown as ClickWiseSettings;
}

export async function updateClickWiseSettings(
  restaurantId: string,
  patch: Partial<Omit<ClickWiseSettings, "id" | "restaurant_id">>,
) {
  const { error } = await supabase
    .from("clickwise_settings")
    .update(patch as never)
    .eq("restaurant_id", restaurantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------- Event queue ----------

export type IntegrationEventRow = {
  id: string;
  restaurant_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: EventStatus;
  attempts: number;
  retry_count: number;
  next_retry_at: string | null;
  processed_at: string | null;
  entity_type: string | null;
  entity_id: string | null;
  clickwise_workflow_id: string | null;
  metadata: Record<string, unknown>;
  last_error: string | null;
  target: string | null;
  created_at: string;
  updated_at: string;
};

export type EventFilter =
  | "all" | "pending" | "processing" | "sent" | "failed" | "skipped"
  | "reservations" | "guests" | "reviews" | "waitlist" | "large_group" | "pre_order";

export async function listIntegrationEvents(
  restaurantId: string,
  filter: EventFilter = "all",
  limit = 100,
): Promise<IntegrationEventRow[]> {
  let q = supabase
    .from("integration_events")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  switch (filter) {
    case "pending":     q = q.eq("status", "pending"); break;
    case "processing":  q = q.eq("status", "processing"); break;
    case "sent":        q = q.eq("status", "sent"); break;
    case "failed":      q = q.eq("status", "failed"); break;
    case "skipped":     q = q.eq("status", "skipped"); break;
    case "reservations":q = q.like("event_type", "reservation.%"); break;
    case "guests":      q = q.like("event_type", "guest.%"); break;
    case "reviews":     q = q.like("event_type", "review.%"); break;
    case "waitlist":    q = q.like("event_type", "waitlist.%"); break;
    case "large_group": q = q.like("event_type", "large_group.%"); break;
    case "pre_order":   q = q.like("event_type", "pre_order.%"); break;
    default: break;
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as IntegrationEventRow[];
}

export async function getEventStats(restaurantId: string) {
  const { data } = await supabase
    .from("integration_events")
    .select("status")
    .eq("restaurant_id", restaurantId)
    .limit(2000);
  const rows = data ?? [];
  return {
    pending:    rows.filter((r) => r.status === "pending").length,
    processing: rows.filter((r) => r.status === "processing").length,
    sent:       rows.filter((r) => r.status === "sent").length,
    failed:     rows.filter((r) => r.status === "failed").length,
    skipped:    rows.filter((r) => r.status === "skipped").length,
    total:      rows.length,
  };
}

export async function markEventProcessed(eventId: string) {
  const { error } = await supabase
    .from("integration_events")
    .update({ status: "sent", processed_at: new Date().toISOString() })
    .eq("id", eventId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function markEventSkipped(eventId: string, reason?: string) {
  const { error } = await supabase
    .from("integration_events")
    .update({ status: "skipped", last_error: reason ?? null, processed_at: new Date().toISOString() })
    .eq("id", eventId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function prepareRetry(eventId: string) {
  const { data: existing } = await supabase
    .from("integration_events")
    .select("retry_count")
    .eq("id", eventId).maybeSingle();
  const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("integration_events")
    .update({
      status: "pending",
      retry_count: ((existing?.retry_count as number | undefined) ?? 0) + 1,
      next_retry_at: nextRetryAt,
      last_error: null,
    })
    .eq("id", eventId);
  return error ? { ok: false, error: error.message } : { ok: true, nextRetryAt };
}

// ---------- Payload preview ----------

export function buildSamplePayload(eventType: string, restaurantName = "Bistro De Haven") {
  const base = {
    event_type: eventType,
    sent_at: new Date().toISOString(),
    sandbox: true,
    restaurant: { id: "00000000-0000-0000-0000-000000000000", name: restaurantName },
  };
  switch (eventType) {
    case "reservation.created":
    case "reservation.updated":
    case "reservation.cancelled":
    case "reservation.completed":
    case "reservation.no_show":
      return {
        ...base,
        guest: { name: "Jansen", phone: "+316XXXXXXXX", email: "gast@example.com", preferred_channel: "whatsapp" },
        reservation: { date: "2026-05-01", time: "19:00", party_size: 4, status: "confirmed", source_channel: "website_widget" },
      };
    case "review.requested":
    case "review.positive_feedback":
    case "review.negative_feedback":
      return {
        ...base,
        guest: { name: "Jansen", email: "gast@example.com" },
        review: { rating: eventType.includes("positive") ? 5 : eventType.includes("negative") ? 2 : null, follow_up_required: eventType.includes("negative") },
      };
    case "waitlist.created":
    case "waitlist.match_suggested":
    case "waitlist.notification_requested":
    case "waitlist.converted":
      return {
        ...base,
        guest: { name: "De Vries", phone: "+316XXXXXXXX" },
        waitlist: { desired_date: "2026-05-02", party_size: 2, zone_preference: "binnen", status: "waiting" },
      };
    case "large_group.requested":
    case "large_group.approved":
    case "large_group.declined":
      return {
        ...base,
        contact: { name: "Familie De Boer", email: "deboer@example.com", phone: "+316XXXXXXXX" },
        large_group: { party_size: 14, preferred_date: "2026-06-12", preferred_time: "18:30", occasion: "verjaardag" },
      };
    case "guest.created":
    case "guest.updated":
    case "guest.marketing_opt_in_updated":
      return {
        ...base,
        guest: { name: "Jansen", email: "gast@example.com", phone: "+316XXXXXXXX", marketing_opt_in: true, visit_count: 3 },
      };
    case "pre_order.added":
    case "pre_order.prepared":
    case "pre_order.served":
      return {
        ...base,
        guest: { name: "Jansen" },
        pre_order: { items: [{ name: "Prosecco", quantity: 2 }], status: "requested" },
      };
    default:
      return base;
  }
}

// ---------- Contact mapping preview ----------

export type ContactMappingRow = { tableWise: string; clickWise: string; sample: string };

export const CONTACT_MAPPING: ContactMappingRow[] = [
  { tableWise: "first_name + last_name",  clickWise: "Contact naam",                  sample: "Marit Jansen" },
  { tableWise: "phone",                   clickWise: "Contact telefoon",              sample: "+316XXXXXXXX" },
  { tableWise: "email",                   clickWise: "Contact e-mail",                sample: "gast@example.com" },
  { tableWise: "preferred_channel",       clickWise: "Custom field · Voorkeurkanaal", sample: "whatsapp" },
  { tableWise: "preferred_language",      clickWise: "Custom field · Taal",           sample: "nl" },
  { tableWise: "allergies",               clickWise: "Custom field · Allergieën",     sample: "noten" },
  { tableWise: "seating_preferences",     clickWise: "Custom field · Zitvoorkeur",    sample: "rustige hoek" },
  { tableWise: "visit_count",             clickWise: "Custom field · Aantal bezoeken",sample: "3" },
  { tableWise: "no_show_count",           clickWise: "Custom field · No-shows",       sample: "0" },
  { tableWise: "last_visit_at",           clickWise: "Custom field · Laatste bezoek", sample: "2026-04-01" },
  { tableWise: "source_channel",          clickWise: "Custom field · Laatste kanaal", sample: "website_widget" },
];
