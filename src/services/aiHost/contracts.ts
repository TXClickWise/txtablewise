// AI Host action contracts.
// Single source of truth that documents which actions the AI may invoke,
// what it needs, what it gets back, and when a human must be involved.
//
// IMPORTANT: deze contracten worden ook gebruikt in de UI (catalogus + testconsole)
// zodat documentatie en uitvoering nooit uit elkaar lopen.

export type AICallerType =
  | "voice_ai"
  | "whatsapp_ai"
  | "sms_ai"
  | "webchat_ai"
  | "internal_ai"
  | "staff_user"
  | "system";

export const CALLER_LABELS: Record<AICallerType, string> = {
  voice_ai: "Voice AI",
  whatsapp_ai: "WhatsApp AI",
  sms_ai: "SMS AI",
  webchat_ai: "Webchat AI",
  internal_ai: "Interne AI",
  staff_user: "Medewerker",
  system: "Systeem",
};

export type AIActionMode = "internal" | "external";

export type AIActionCategory =
  | "reservations"
  | "waitlist"
  | "walkin"
  | "guests"
  | "preorders"
  | "info"
  | "escalation";

export type AIReasonCode =
  | "no_table_available"
  | "outside_opening_hours"
  | "needs_human_approval"
  | "validation_failed"
  | "not_found"
  | "permission_denied"
  | "engine_error"
  | "not_implemented"
  | "ok";

export type AIActionResponse<TData = Record<string, unknown>> = {
  success: boolean;
  action: string;
  status: "ok" | "error" | "pending_human";
  /** Korte tekst die de AI veilig aan de gast mag voorlezen of versturen. */
  message_for_guest: string;
  /** Detail voor logs/medewerkers. Niet aan de gast tonen. */
  internal_message: string;
  data: TData;
  requires_human: boolean;
  reason_code: AIReasonCode | null;
};

export type AIActionInputField = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "time" | "uuid" | "enum" | "phone" | "email" | "boolean";
  required: boolean;
  enumValues?: string[];
  description?: string;
};

export type AIActionContract = {
  name: string;
  category: AIActionCategory;
  title: string;
  purpose: string;
  inputs: AIActionInputField[];
  allowedCallers: AICallerType[];
  /** Welke caller-types de actie alleen mogen voorbereiden i.p.v. uitvoeren. */
  requiresHumanApprovalFor?: AICallerType[];
  /** Mode: extern = mag tegen gast praten. Intern = alleen voor medewerker-AI. */
  mode: AIActionMode;
  guardrails: string[];
  /** Korte voorbeeldsamenvatting van wat de gast hoort als het lukt. */
  successHint: string;
};

/** AI mag NOOIT zelfstandig uitvoeren; alleen voorbereiden / escaleren. */
const STAFF_ONLY: AICallerType[] = ["staff_user", "internal_ai"];

export const AI_ACTION_CATALOG: AIActionContract[] = [
  // ---------------- Reservations ----------------
  {
    name: "check_availability",
    category: "reservations",
    title: "Beschikbaarheid controleren",
    purpose:
      "De enige manier waarop de AI weet of er plek is. Roept de reserveringsengine aan en geeft passende of alternatieve tijden terug.",
    inputs: [
      { name: "date", label: "Datum", type: "date", required: true },
      { name: "party_size", label: "Aantal gasten", type: "number", required: true },
      { name: "preferred_time", label: "Gewenste tijd (HH:mm)", type: "time", required: false },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: [
      "AI mag NOOIT 'er is plek' zeggen zonder een geslaagde response.",
      "Bij grote groepen valt de AI terug op get_large_group_rules.",
    ],
    successHint: "Er is plek om {time} voor {party_size} personen.",
  },
  {
    name: "create_reservation",
    category: "reservations",
    title: "Reservering aanmaken",
    purpose:
      "Maakt een echte reservering aan via de reserveringsengine. Server hercontroleert beschikbaarheid en pacing.",
    inputs: [
      { name: "date", label: "Datum", type: "date", required: true },
      { name: "time", label: "Tijd (HH:mm)", type: "time", required: true },
      { name: "party_size", label: "Aantal gasten", type: "number", required: true },
      { name: "first_name", label: "Voornaam", type: "text", required: true },
      { name: "last_name", label: "Achternaam", type: "text", required: false },
      { name: "phone", label: "Telefoon", type: "phone", required: false },
      { name: "email", label: "E-mail", type: "email", required: false },
      { name: "special_requests", label: "Wensen", type: "text", required: false },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: [
      "AI mag NOOIT bevestigen tenzij de engine status='confirmed' of 'pending' teruggeeft.",
      "Grote groepen krijgen status='pending' en moeten als aanvraag worden gepresenteerd.",
      "Telefoon óf e-mail is verplicht voor reconfirm/no-show flow.",
    ],
    successHint: "Genoteerd! Bevestiging: {confirmation_code}.",
  },
  {
    name: "update_reservation",
    category: "reservations",
    title: "Reservering wijzigen",
    purpose: "Wijzig datum, tijd, aantal gasten of wensen via de reserveringsengine.",
    inputs: [
      { name: "reservation_id", label: "Reserveringsnummer", type: "uuid", required: true },
      { name: "new_date", label: "Nieuwe datum", type: "date", required: false },
      { name: "new_time", label: "Nieuwe tijd", type: "time", required: false },
      { name: "new_party_size", label: "Nieuw aantal", type: "number", required: false },
      { name: "special_requests", label: "Wensen", type: "text", required: false },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: ["Engine valideert opnieuw of de nieuwe combinatie past."],
    successHint: "We hebben je reservering aangepast.",
  },
  {
    name: "cancel_reservation",
    category: "reservations",
    title: "Reservering annuleren",
    purpose: "Annuleert een reservering. Triggert ClickWise-events voor opvolging.",
    inputs: [
      { name: "reservation_id", label: "Reserveringsnummer", type: "uuid", required: true },
      { name: "reason", label: "Reden", type: "text", required: false },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: ["Bij annulering vlak voor aanvang vriendelijk waarschuwen voor mogelijke aanbetalingsregels."],
    successHint: "Je reservering is geannuleerd.",
  },
  {
    name: "find_reservation_by_phone",
    category: "reservations",
    title: "Reservering zoeken op telefoonnummer",
    purpose: "Vindt aankomende reservering(en) van een gast op basis van telefoonnummer.",
    inputs: [
      { name: "phone", label: "Telefoonnummer", type: "phone", required: true },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: ["Geef nooit details prijs zonder bevestiging van naam/datum."],
    successHint: "Ik zie je reservering staan.",
  },
  {
    name: "get_reservation_details",
    category: "reservations",
    title: "Reserveringsdetails opvragen",
    purpose: "Haalt details op van een specifieke reservering (alleen voor de gast in kwestie).",
    inputs: [
      { name: "reservation_id", label: "Reserveringsnummer", type: "uuid", required: true },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: ["Toon nooit interne notities aan de gast."],
    successHint: "Ik heb de details voor je.",
  },
  {
    name: "reconfirm_reservation",
    category: "reservations",
    title: "Reservering herbevestigen",
    purpose: "Markeert een reservering als herbevestigd door de gast.",
    inputs: [
      { name: "reservation_id", label: "Reserveringsnummer", type: "uuid", required: true },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: [],
    successHint: "Bedankt voor het bevestigen!",
  },

  // ---------------- Waitlist ----------------
  {
    name: "create_waitlist_entry",
    category: "waitlist",
    title: "Wachtlijst-aanmelding",
    purpose: "Plaatst een gast op de wachtlijst voor een dag/tijd waar geen plek is.",
    inputs: [
      { name: "date", label: "Gewenste datum", type: "date", required: true },
      { name: "time_from", label: "Tijd vanaf", type: "time", required: false },
      { name: "time_to", label: "Tijd tot", type: "time", required: false },
      { name: "party_size", label: "Aantal gasten", type: "number", required: true },
      { name: "first_name", label: "Voornaam", type: "text", required: true },
      { name: "phone", label: "Telefoon", type: "phone", required: false },
      { name: "email", label: "E-mail", type: "email", required: false },
      { name: "notes", label: "Notitie", type: "text", required: false },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: ["Bevestig nooit dat een tafel komt — alleen dat de gast op de wachtlijst staat."],
    successHint: "Je staat op de wachtlijst. We laten het weten zodra er plek vrijkomt.",
  },
  {
    name: "find_waitlist_matches",
    category: "waitlist",
    title: "Wachtlijst-matches vinden",
    purpose: "Zoekt openstaande wachtlijst-aanmeldingen die passen bij een vrijgekomen tijdslot.",
    inputs: [
      { name: "date", label: "Datum", type: "date", required: true },
      { name: "time", label: "Vrijgekomen tijd", type: "time", required: true },
      { name: "party_size", label: "Aantal gasten", type: "number", required: true },
    ],
    allowedCallers: STAFF_ONLY,
    mode: "internal",
    guardrails: ["Alleen intern — extern AI mag dit niet zien."],
    successHint: "Mogelijke matches gevonden.",
  },
  {
    name: "convert_waitlist_to_reservation",
    category: "waitlist",
    title: "Wachtlijst → reservering",
    purpose: "Zet een wachtlijst-aanmelding om in een echte reservering. Vereist menselijke bevestiging.",
    inputs: [
      { name: "waitlist_entry_id", label: "Wachtlijst-ID", type: "uuid", required: true },
      { name: "time", label: "Tijd", type: "time", required: true },
    ],
    allowedCallers: STAFF_ONLY,
    requiresHumanApprovalFor: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai"],
    mode: "internal",
    guardrails: ["Externe AI bereidt voor; medewerker bevestigt."],
    successHint: "Wachtlijstgast omgezet naar reservering.",
  },

  // ---------------- Walk-ins ----------------
  {
    name: "create_walk_in",
    category: "walkin",
    title: "Walk-in registreren",
    purpose: "Registreert een spontane gast en zet status op 'seated'.",
    inputs: [
      { name: "party_size", label: "Aantal gasten", type: "number", required: true },
      { name: "table_id", label: "Tafel-ID", type: "uuid", required: false },
      { name: "first_name", label: "Naam", type: "text", required: false },
    ],
    allowedCallers: STAFF_ONLY,
    mode: "internal",
    guardrails: ["Walk-ins zijn een operationele actie — geen externe AI."],
    successHint: "Walk-in geregistreerd.",
  },
  {
    name: "suggest_table_for_walk_in",
    category: "walkin",
    title: "Tafelsuggestie voor walk-in",
    purpose: "Doet een tafelsuggestie op basis van groepsgrootte en huidige bezetting.",
    inputs: [
      { name: "party_size", label: "Aantal gasten", type: "number", required: true },
    ],
    allowedCallers: STAFF_ONLY,
    mode: "internal",
    guardrails: [],
    successHint: "Suggestie klaar.",
  },

  // ---------------- Guests ----------------
  {
    name: "find_or_create_guest",
    category: "guests",
    title: "Gast vinden of aanmaken",
    purpose: "Zoekt een gast op telefoon/e-mail. Maakt een nieuw profiel aan als er geen match is.",
    inputs: [
      { name: "first_name", label: "Voornaam", type: "text", required: true },
      { name: "phone", label: "Telefoon", type: "phone", required: false },
      { name: "email", label: "E-mail", type: "email", required: false },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: ["Telefoon óf e-mail vereist om dubbele profielen te voorkomen."],
    successHint: "Gastprofiel klaar.",
  },
  {
    name: "add_guest_note",
    category: "guests",
    title: "Notitie toevoegen aan gast",
    purpose: "Voegt een korte hospitality-notitie toe aan een gastprofiel.",
    inputs: [
      { name: "guest_id", label: "Gast-ID", type: "uuid", required: true },
      { name: "note", label: "Notitie", type: "text", required: true },
      {
        name: "note_type",
        label: "Type",
        type: "enum",
        required: false,
        enumValues: ["general", "preference", "allergy", "service", "special_occasion"],
      },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: ["Geen klachten of medische gegevens noteren zonder toestemming."],
    successHint: "Notitie toegevoegd.",
  },

  // ---------------- Pre-orders ----------------
  {
    name: "get_pre_order_options",
    category: "preorders",
    title: "Pre-order opties ophalen",
    purpose: "Haalt actieve pre-order items op (bijv. prosecco, borrelplank).",
    inputs: [],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: [],
    successHint: "Hier zijn de opties.",
  },
  {
    name: "add_pre_order_to_reservation",
    category: "preorders",
    title: "Pre-order koppelen",
    purpose: "Voegt een pre-order item toe aan een bestaande reservering.",
    inputs: [
      { name: "reservation_id", label: "Reserveringsnummer", type: "uuid", required: true },
      { name: "pre_order_item_id", label: "Item-ID", type: "uuid", required: true },
      { name: "quantity", label: "Aantal", type: "number", required: false },
      { name: "note", label: "Notitie", type: "text", required: false },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: [],
    successHint: "Pre-order genoteerd.",
  },

  // ---------------- Info ----------------
  {
    name: "get_opening_hours",
    category: "info",
    title: "Openingstijden",
    purpose: "Geeft openingstijden per weekdag terug, plus actieve sluitingen.",
    inputs: [],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: [],
    successHint: "Hier zijn onze openingstijden.",
  },
  {
    name: "get_location_info",
    category: "info",
    title: "Locatie-informatie",
    purpose: "Geeft adres, plaats en contactgegevens van het restaurant terug.",
    inputs: [],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: [],
    successHint: "Hier vind je ons.",
  },
  {
    name: "get_booking_rules",
    category: "info",
    title: "Boekingsregels",
    purpose: "Geeft online maximale groepsgrootte, voorbereidingstijd en horizon terug.",
    inputs: [],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: [],
    successHint: "Onze boekingsregels in het kort.",
  },
  {
    name: "get_large_group_rules",
    category: "info",
    title: "Regels grote groepen",
    purpose: "Geeft drempels en voorwaarden voor grote groepen terug (handmatige goedkeuring, aanbetaling, etc.).",
    inputs: [],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: [],
    successHint: "Voor grote groepen geldt het volgende.",
  },
  {
    name: "get_cancellation_policy",
    category: "info",
    title: "Annuleringsbeleid",
    purpose: "Geeft annulerings- en aanbetalingsregels van dit restaurant terug.",
    inputs: [],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: [],
    successHint: "Ons annuleringsbeleid.",
  },

  // ---------------- Escalation ----------------
  {
    name: "escalate_to_staff",
    category: "escalation",
    title: "Escaleer naar medewerker",
    purpose: "Maakt een actiepunt aan zodat een medewerker de gast terugbelt of overneemt.",
    inputs: [
      { name: "reason", label: "Reden", type: "text", required: true },
      { name: "phone", label: "Telefoon gast", type: "phone", required: false },
      { name: "summary", label: "Korte samenvatting", type: "text", required: false },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: ["Altijd inzetten bij klachten, twijfel, taalbarrière of speciale wensen."],
    successHint: "Een collega neemt het over.",
  },
  {
    name: "request_human_callback",
    category: "escalation",
    title: "Terugbelverzoek",
    purpose: "Registreert een terugbelverzoek met telefoonnummer en korte context.",
    inputs: [
      { name: "phone", label: "Telefoon", type: "phone", required: true },
      { name: "reason", label: "Reden", type: "text", required: false },
    ],
    allowedCallers: ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"],
    mode: "external",
    guardrails: [],
    successHint: "We bellen je terug.",
  },
];

export const CATEGORY_LABEL: Record<AIActionCategory, string> = {
  reservations: "Reserveringen",
  waitlist: "Wachtlijst",
  walkin: "Walk-in",
  guests: "Gasten",
  preorders: "Pre-orders",
  info: "Informatie",
  escalation: "Escalatie",
};

export function getActionByName(name: string): AIActionContract | undefined {
  return AI_ACTION_CATALOG.find((a) => a.name === name);
}

export function isCallerAllowed(action: AIActionContract, caller: AICallerType): boolean {
  return action.allowedCallers.includes(caller);
}

export function callerNeedsHumanApproval(action: AIActionContract, caller: AICallerType): boolean {
  return Boolean(action.requiresHumanApprovalFor?.includes(caller));
}
