// Realistische test-payloads voor webhook end-to-end testen vanuit instellingen.
// Elke preset levert een `integration_events`-rij die meteen via dispatch_webhooks
// naar ClickWise wordt gepushed.

export type WebhookFixture = {
  key: string;
  event_type: string;
  label: string;
  description: string;
  payload: Record<string, unknown>;
};

const sampleGuest = {
  guest_id: "00000000-0000-0000-0000-000000000001",
  first_name: "Test",
  last_name: "Gast",
  email: "test@voorbeeld.nl",
  phone: "+31612345678",
};

const sampleReservation = {
  reservation_id: "00000000-0000-0000-0000-000000000010",
  reservation_date: new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10),
  start_time: new Date(Date.now() + 24 * 3600_000).toISOString(),
  party_size: 4,
  confirmation_code: "TW-TEST",
  source_channel: "website_widget",
  manage_url: "https://txtablewise.nl/manage/test-token",
};

export const webhookFixtures: WebhookFixture[] = [
  {
    key: "confirmed",
    event_type: "reservation.confirmed",
    label: "Reservering bevestigd",
    description: "Standaard flow — bevestigingsmail/SMS triggeren.",
    payload: { ...sampleReservation, guest: sampleGuest, status: "confirmed" },
  },
  {
    key: "cancelled",
    event_type: "reservation.cancelled",
    label: "Reservering geannuleerd",
    description: "Wachtlijst-trigger + bevestiging van annulering.",
    payload: { ...sampleReservation, guest: sampleGuest, status: "cancelled", cancellation_reason: "Gast kan niet" },
  },
  {
    key: "reminder_24h",
    event_type: "reservation.reminder_24h",
    label: "Reminder 24 uur",
    description: "Herinneringsbericht aan gast.",
    payload: { ...sampleReservation, guest: sampleGuest, hours_until: 24 },
  },
  {
    key: "reminder_2h",
    event_type: "reservation.reminder_2h",
    label: "Reminder 2 uur",
    description: "Korte-termijn herinnering met routebeschrijving.",
    payload: { ...sampleReservation, guest: sampleGuest, hours_until: 2 },
  },
  {
    key: "no_show",
    event_type: "reservation.no_show",
    label: "No-show gemarkeerd",
    description: "Triggert eventuele aftercare/feedback-flow.",
    payload: { ...sampleReservation, guest: sampleGuest, status: "no_show" },
  },
  {
    key: "waitlist_match",
    event_type: "waitlist.match_offered",
    label: "Wachtlijst — plek aangeboden",
    description: "Vrijgekomen tijdvenster aanbieden aan wachtlijstgast.",
    payload: {
      waitlist_entry_id: "00000000-0000-0000-0000-000000000020",
      guest: sampleGuest,
      offered_date: sampleReservation.reservation_date,
      offered_time: "19:30",
      party_size: 4,
      response_deadline_minutes: 15,
    },
  },
];
