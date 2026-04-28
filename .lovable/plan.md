
# Doel

Een schone, publieke API-laag voor TableWise die ClickWise, AI Voice Agents, WhatsApp/SMS-bots en CRM's eenvoudig kunnen gebruiken — zonder een tweede reserveringsengine te bouwen. Alle bestaande interne flows (widget, /app, agent_api) blijven exact werken.

# Aanpak in één zin

We bouwen één nieuwe edge function `public_api` die alle `/api/public/*` routes afhandelt, payloads valideert in een Guestplan-achtig formaat, en intern de bestaande engines (`availability`, `book_reservation`, `manage_reservation`) aanroept. Niets in de bestaande functies wordt vervangen.

# Architectuur

```text
ClickWise / Voice / Bot / CRM
            │
            ▼
   POST /functions/v1/public_api/availability
   POST /functions/v1/public_api/reservations
   PATCH /functions/v1/public_api/reservations/:id
   DELETE /functions/v1/public_api/reservations/:id
            │  (auth: X-TableWise-Api-Key  → agent_api_keys)
            ▼
       public_api (NEW)
        - parseert Guestplan-stijl payload
        - mapt naar interne payload
        - vertaalt interne errors → TW_* codes
            │
            ├─► availability        (bestaand, ongewijzigd)
            ├─► book_reservation    (bestaand, ongewijzigd)
            └─► manage_reservation  (bestaand, ongewijzigd via service role)
```

Belangrijke keuzes:
- Hergebruik van `agent_api_keys` voor authenticatie (zelfde sleutel werkt straks voor `agent_api` én `public_api`). Geen nieuwe sleuteltabel.
- Geen wijzigingen aan database, RLS of bestaande edge functions.
- `restaurant_id` wordt altijd afgeleid uit de API-key (cross-tenant onmogelijk). `restaurantId`/`locationId` in de body wordt geaccepteerd maar genegeerd als die afwijkt → `TW_403_TENANT_MISMATCH`.

# Endpoints

## 1. POST /public_api/availability
Body (Guestplan-stijl, camelCase):
```json
{ "locationId": "<uuid>", "localDate": "2026-05-01", "localTime": "19:30", "partySize": 4 }
```
Mapping → intern `availability` payload (snake_case + `date`, `party_size`).
Response:
```json
{
  "isAvailable": true,
  "isAvailableWithWaitlist": false,
  "requestedSlot": { "localDate": "...", "localTime": "19:30", "available": true },
  "availableSlots": [ { "localTime": "19:00", "available": true, "peakWarning": false }, ... ],
  "suggestedAlternatives": [ { "localTime": "19:15" }, { "localTime": "19:45" } ],
  "reason": null
}
```
`reason` wordt gevuld met TW_-code als `requestedSlot.available === false` (bv. `TW_409_TIMESLOT_UNAVAILABLE`, `TW_409_PARTY_TOO_LARGE`, `TW_423_RESTAURANT_CLOSED`).

## 2. POST /public_api/reservations
Body:
```json
{
  "locationId": "<uuid>",
  "localDate": "2026-05-01",
  "localTime": "19:30",
  "partySize": 4,
  "contact": { "fullName": "Willem van Oranje", "phone": "+31612345678", "email": "w@x.nl", "language": "nl" },
  "notes": "Hoekje graag",
  "source": "voice_agent",
  "externalReference": "vapi_call_abc123"
}
```
Mapping naar interne `book_reservation` payload:
- `contact.fullName` → splitsen op laatste spatie → `guest.first_name`, `guest.last_name` (of direct `firstName`/`lastName` overnemen).
- `contact.phone` → verplicht; gevalideerd via E.164-achtige regex (`/^\+?[0-9\s\-()]{7,20}$/`).
- `contact.email` ontbreekt? `public_api` genereert geen placeholder zoals `agent_api` doet — emails zijn optioneel; intern wordt een neutrale placeholder gebruikt zodat de bestaande email-validatie in `book_reservation` slaagt, en in `source_metadata.email_provided=false` gemarkeerd. Zo blijven bestaande dedupe-regels (per email) intact.
- `source` → vaste mapping naar interne `channel` enum (`voice_agent`→`ai_host`, `whatsapp`→`clickwise`, etc.). Onbekende waarden → `online` met `source_metadata.source` bewaard.
- `externalReference` → `source_metadata.external_reference` + topfield `external_reference` op de reservering.

Response:
```json
{
  "status": "confirmed",
  "reservationId": "<uuid>",
  "reservationCode": "AB23CD45",
  "localDate": "2026-05-01",
  "localTime": "19:30",
  "partySize": 4,
  "guest": { "fullName": "...", "phone": "...", "email": "..." },
  "links": {
    "self":   "https://.../api/public/reservations/<id>",
    "update": "https://.../api/public/reservations/<id>",
    "cancel": "https://.../api/public/reservations/<id>",
    "guestManage": "https://txtablewise.lovable.app/manage/<manage_token>"
  }
}
```

## 3. PATCH /public_api/reservations/:id
Body (alle velden optioneel):
```json
{ "localDate": "...", "localTime": "...", "partySize": 5, "notes": "...", "contact": { "phone": "..." } }
```
Mapping → `manage_reservation` met `action: "update"`. Authenticatie via API-key, intern callen we `manage_reservation` met service-role + impersonatie van `restaurant_id` (we voegen géén bypass toe in `manage_reservation`; in plaats daarvan gebruiken we direct DB writes voor de toegestane velden binnen `restaurant_id` van de key — exact zoals `agent_api/cancel_reservation` dat al doet).

Voor wijzigingen van datum/tijd/personen valt `public_api` terug op een nieuwe interne helper-call die hergebruikt wat `book_reservation`/`manage_reservation` aan tafel- en pacing-checks doen. We doen dit zonder code-duplicatie door `manage_reservation` als HTTP-call te invoken met een service-role JWT en een speciale header `X-Internal-Caller: public_api` die we in `manage_reservation` accepteren als equivalent voor "operator-actie" voor enkel `update` en `cancel`. (Kleine, geïsoleerde wijziging in `manage_reservation`; geen gedragswijziging voor bestaande operators.)

## 4. DELETE /public_api/reservations/:id
Optionele query: `?reason=...`. Mapping → `manage_reservation` met `action: "cancel"` (zelfde mechanisme als hierboven), of fallback direct DB update zoals `agent_api/cancel_reservation`.

# Validatie & Foutcodes

Alle errors hebben de vorm:
```json
{ "error": { "code": "TW_400_MISSING_DATE", "message": "...", "field": "localDate", "suggestedFix": "Voeg localDate (YYYY-MM-DD) toe." } }
```

Mapping van validaties:

| Conditie | HTTP | Code |
|---|---|---|
| `localDate` ontbreekt | 400 | `TW_400_MISSING_DATE` |
| `localTime` ontbreekt | 400 | `TW_400_MISSING_TIME` |
| `partySize` ontbreekt/0 | 400 | `TW_400_MISSING_PARTY_SIZE` |
| Telefoon ongeldig | 400 | `TW_400_INVALID_PHONE` |
| Email ongeldig (indien gegeven) | 400 | `TW_400_INVALID_EMAIL` |
| Datum in verleden | 400 | `TW_400_DATE_IN_PAST` |
| Naam ontbreekt | 400 | `TW_400_MISSING_NAME` |
| API-key ontbreekt/ongeldig | 401 | `TW_401_AUTH_INVALID` |
| Sleutel mist scope | 403 | `TW_403_SCOPE_MISSING` |
| `locationId` ≠ key tenant | 403 | `TW_403_TENANT_MISMATCH` |
| Reservering niet gevonden | 404 | `TW_404_RESERVATION_NOT_FOUND` |
| Restaurant gesloten | 423 | `TW_423_RESTAURANT_CLOSED` |
| Tijdslot bezet (`slot_unavailable`/`no_table_available`) | 409 | `TW_409_TIMESLOT_UNAVAILABLE` |
| Pacing vol | 409 | `TW_409_PACING_FULL` |
| Groep te groot voor online | 409 | `TW_409_PARTY_TOO_LARGE` |
| Mogelijke duplicate (zelfde email+date+time binnen 5 min) | 409 | `TW_409_POSSIBLE_DUPLICATE` |
| Reservering niet wijzigbaar (status cancelled/no_show) | 422 | `TW_422_RESERVATION_NOT_VALID` |
| Interne fout | 500 | `TW_500_INTERNAL` |

`public_api` heeft één centrale mapper: `mapInternalError(internalErrorCode) → TWCode` zodat één plek alle vertalingen beheert.

# Bestanden die we maken/aanpassen

Nieuw:
- `supabase/functions/public_api/index.ts` — router + validatie + mapping + interne fetches.
- `supabase/functions/_shared/tw-errors.ts` — TW-codes, mapper, helper `twError(code, field?, customMessage?)`.
- `docs/PUBLIC_API.md` — endpointreferentie met voorbeelden voor ClickWise/Voice/cURL.
- `docs/PUBLIC_API_ERROR_CODES.md` — volledige TW_-tabel.

Klein aanpassen (non-breaking):
- `supabase/functions/manage_reservation/index.ts` — accepteer header `X-Internal-Caller: public_api` met service-role JWT als equivalent voor operator (alleen voor `update` en `cancel`). Bestaand operatorpad blijft ongewijzigd.
- `src/pages/app/IntegrationHubPage.tsx` — voeg een tab "Publieke API" toe met endpoint-lijst, voorbeeld-cURL en knop "Open documentatie". Geen bestaande tabs aanraken.

Niet aangeraakt:
- `availability`, `book_reservation`, `agent_api`, `guest_reservation`, `dispatch_webhooks`, `clickwise_process_event`, RLS, datamodel.

# Auth

- Header: `X-TableWise-Api-Key: tw_live_...`
- Validatie identiek aan `agent_api`: SHA-256 hash → lookup in `agent_api_keys`, scopes: `availability`, `book`, `cancel`, plus nieuwe optionele scope `update` (default toegevoegd aan bestaande sleutels via fallback: ontbrekende `update`-scope → toegestaan, met deprecation note in response header `X-TableWise-Deprecation`).
- `last_used_at` wordt bijgewerkt (best effort).

# UX in Integration Hub

Nieuwe tab "Publieke API" met:
- Endpoint-blokken met copy-knop (cURL + JSON).
- Live "Test availability" en "Test reservation" knoppen die naar `public_api` gaan met `source_metadata.test=true` (volgt bestaande `integration_test`-patroon).
- Tabel met TW-foutcodes en uitleg.
- Verwijzing: "Wil je dit zelf koppelen aan ClickWise/Vapi/Retell? Zie /app/voice-agent voor field-checklist."

# Guardrails (bevestigd)

- Geen breaking changes: alle bestaande functies behouden hun huidige routes en payloads.
- Geen tweede engine: `public_api` doet alleen routing/validatie/mapping, écht boeken gebeurt in `book_reservation`.
- Geen DB-migratie nodig.
- Geen secrets in code; API-keys deels gemaskerd in UI (bestaand patroon).
- Webhooks worden alleen geraakt via bestaande `book_reservation`-flow (die `integration_events.created` insert doet) — geen extra webhook-firing in `public_api`.

# Open vragen voor jou

1. **Routebasis**: gebruik je liever de pure functie-URL (`/functions/v1/public_api/...`) of moet ik ook een rewrite documenteren naar `/api/public/...` (vereist een hostingrewrite die we niet beheren — voorstel: alleen `/functions/v1/public_api/...` gebruiken en in docs als `POST <BASE>/availability` presenteren)?
2. **Update-scope op bestaande keys**: nieuwe scope `update` standaard toekennen aan oude keys (backwards compatible) of forceren dat de gebruiker hem expliciet aanvinkt in de Hub UI?
3. **Duplicate-detectie venster**: 5 minuten standaard ok, of strenger (15 min) zoals Guestplan?
