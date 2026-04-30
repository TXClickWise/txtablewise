// TableWise public API error codes (TW_*).
// Centralised so every endpoint maps internal errors to one consistent format.
//
// Response shape:
// { "error": { "code": "TW_400_MISSING_DATE", "message": "...", "field": "localDate", "suggestedFix": "..." } }

export type TwCode =
  | "TW_400_MISSING_DATE"
  | "TW_400_MISSING_TIME"
  | "TW_400_MISSING_PARTY_SIZE"
  | "TW_400_MISSING_NAME"
  | "TW_400_MISSING_PHONE"
  | "TW_400_MISSING_CONTACT"
  | "TW_400_INVALID_PHONE"
  | "TW_400_INVALID_EMAIL"
  | "TW_400_INVALID_DATE"
  | "TW_400_INVALID_TIME"
  | "TW_400_DATE_IN_PAST"
  | "TW_400_INVALID_BODY"
  | "TW_401_AUTH_MISSING"
  | "TW_401_AUTH_INVALID"
  | "TW_403_SCOPE_MISSING"
  | "TW_403_TENANT_MISMATCH"
  | "TW_404_RESERVATION_NOT_FOUND"
  | "TW_404_RESTAURANT_NOT_FOUND"
  | "TW_405_METHOD_NOT_ALLOWED"
  | "TW_409_TIMESLOT_UNAVAILABLE"
  | "TW_409_PACING_FULL"
  | "TW_409_PARTY_TOO_LARGE"
  | "TW_409_POSSIBLE_DUPLICATE"
  | "TW_422_RESERVATION_NOT_VALID"
  | "TW_423_RESTAURANT_CLOSED"
  | "TW_500_INTERNAL";

const META: Record<TwCode, { http: number; message: string; suggestedFix: string }> = {
  TW_400_MISSING_DATE:        { http: 400, message: "Datum ontbreekt.",                        suggestedFix: "Voeg 'localDate' toe in formaat YYYY-MM-DD." },
  TW_400_MISSING_TIME:        { http: 400, message: "Tijd ontbreekt.",                         suggestedFix: "Voeg 'localTime' toe in formaat HH:MM (24-uurs)." },
  TW_400_MISSING_PARTY_SIZE:  { http: 400, message: "Aantal personen ontbreekt.",              suggestedFix: "Voeg 'partySize' toe als geheel getal ≥ 1." },
  TW_400_MISSING_NAME:        { http: 400, message: "Naam van de gast ontbreekt.",             suggestedFix: "Voeg 'contact.fullName' of 'contact.firstName' + 'contact.lastName' toe." },
  TW_400_MISSING_PHONE:       { http: 400, message: "Telefoonnummer ontbreekt.",               suggestedFix: "Voeg 'contact.phone' toe in internationaal formaat (bv. +31612345678)." },
  TW_400_MISSING_CONTACT:     { http: 400, message: "Telefoon of e-mail van de gast ontbreekt.", suggestedFix: "Vraag de gast om een telefoonnummer of e-mailadres en voeg deze toe als 'contact.phone' of 'contact.email'." },
  TW_400_INVALID_PHONE:       { http: 400, message: "Telefoonnummer is ongeldig.",             suggestedFix: "Gebruik internationaal formaat zoals +31612345678 (7–20 cijfers)." },
  TW_400_INVALID_EMAIL:       { http: 400, message: "E-mailadres is ongeldig.",                suggestedFix: "Geef een geldig e-mailadres of laat 'contact.email' weg." },
  TW_400_INVALID_DATE:        { http: 400, message: "Datum is ongeldig.",                      suggestedFix: "Gebruik formaat YYYY-MM-DD." },
  TW_400_INVALID_TIME:        { http: 400, message: "Tijd is ongeldig.",                       suggestedFix: "Gebruik formaat HH:MM (00:00–23:59)." },
  TW_400_DATE_IN_PAST:        { http: 400, message: "De gevraagde datum/tijd ligt in het verleden.", suggestedFix: "Kies een datum/tijd in de toekomst." },
  TW_400_INVALID_BODY:        { http: 400, message: "Body is geen geldige JSON.",              suggestedFix: "Stuur een geldige JSON body met Content-Type: application/json." },
  TW_401_AUTH_MISSING:        { http: 401, message: "API-sleutel ontbreekt.",                  suggestedFix: "Voeg header 'X-TableWise-Api-Key: <jouw-sleutel>' toe." },
  TW_401_AUTH_INVALID:        { http: 401, message: "API-sleutel is ongeldig of ingetrokken.", suggestedFix: "Genereer een nieuwe sleutel in TableWise → Integraties → Hub." },
  TW_403_SCOPE_MISSING:       { http: 403, message: "Deze API-sleutel mist de benodigde scope.", suggestedFix: "Geef de sleutel de juiste scope (availability/book/cancel/update) in de Hub." },
  TW_403_TENANT_MISMATCH:     { http: 403, message: "locationId hoort niet bij deze API-sleutel.", suggestedFix: "Laat 'locationId' weg of gebruik de sleutel van de juiste vestiging." },
  TW_404_RESERVATION_NOT_FOUND:{ http: 404, message: "Reservering niet gevonden.",             suggestedFix: "Controleer 'reservationId' en of de reservering bij deze vestiging hoort." },
  TW_404_RESTAURANT_NOT_FOUND:{ http: 404, message: "Vestiging niet gevonden.",                suggestedFix: "Controleer 'locationId' of de API-sleutel." },
  TW_405_METHOD_NOT_ALLOWED:  { http: 405, message: "Methode niet toegestaan op dit endpoint.", suggestedFix: "Zie /docs/PUBLIC_API.md voor toegestane methodes per route." },
  TW_409_TIMESLOT_UNAVAILABLE:{ http: 409, message: "Dit tijdslot is niet meer beschikbaar.",  suggestedFix: "Probeer een ander tijdstip of vraag eerst /availability op." },
  TW_409_PACING_FULL:         { http: 409, message: "Het tijdslot is operationeel vol (pacing-limiet).", suggestedFix: "Kies een aangrenzend tijdstip of plaats de gast op de wachtlijst." },
  TW_409_PARTY_TOO_LARGE:     { http: 409, message: "Groep te groot voor online boeking.",     suggestedFix: "Stuur een large-group aanvraag of laat het restaurant handmatig boeken." },
  TW_409_POSSIBLE_DUPLICATE:  { http: 409, message: "Mogelijke dubbele reservering gedetecteerd.", suggestedFix: "Wacht enkele minuten of voeg 'externalReference' toe om expliciet te overschrijven." },
  TW_422_RESERVATION_NOT_VALID:{ http: 422, message: "Reservering kan niet meer worden gewijzigd.", suggestedFix: "Gecancelde of voltooide reserveringen kunnen niet meer worden aangepast." },
  TW_423_RESTAURANT_CLOSED:   { http: 423, message: "Restaurant is gesloten op dit moment.",   suggestedFix: "Kies een andere datum of tijd binnen openingstijden." },
  TW_500_INTERNAL:            { http: 500, message: "Interne fout. Probeer het later opnieuw.", suggestedFix: "Neem contact op met support@tablewise.nl als dit blijft gebeuren." },
};

export function twHttp(code: TwCode): number {
  return META[code].http;
}

export function twError(code: TwCode, field?: string, customMessage?: string) {
  const m = META[code];
  return {
    error: {
      code,
      message: customMessage ?? m.message,
      field: field ?? null,
      suggestedFix: m.suggestedFix,
    },
  };
}

// Map internal error_code (from book_reservation / availability / manage_reservation) → TW code.
export function mapInternalError(internalCode: string | undefined | null): TwCode {
  switch (internalCode) {
    case "missing_field":              return "TW_400_INVALID_BODY";
    case "invalid_email":              return "TW_400_INVALID_EMAIL";
    case "invalid_field":              return "TW_400_INVALID_BODY";
    case "slot_too_soon":              return "TW_400_DATE_IN_PAST";
    case "slot_unavailable":
    case "no_table_available":         return "TW_409_TIMESLOT_UNAVAILABLE";
    case "pacing_limit_reached":       return "TW_409_PACING_FULL";
    case "large_group_required_manual":return "TW_409_PARTY_TOO_LARGE";
    case "not_found":                  return "TW_404_RESERVATION_NOT_FOUND";
    case "auth_missing":               return "TW_401_AUTH_MISSING";
    case "auth_invalid":
    case "auth_revoked":               return "TW_401_AUTH_INVALID";
    case "auth_scope_missing":         return "TW_403_SCOPE_MISSING";
    default:                           return "TW_500_INTERNAL";
  }
}
