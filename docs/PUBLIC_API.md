# TableWise Public API

Een eenvoudige, Guestplan-stijl API om reserveringen te beheren vanuit externe systemen
zoals **ClickWise**, **AI Voice Agents** (Vapi/Retell/HighLevel), **WhatsApp/SMS-bots** en **CRM's**.

> Belangrijk: dit is een **dunne buitenlaag** bovenop de bestaande TableWise-engine.
> Alle echte logica (beschikbaarheid, tafeltoewijzing, pacing, no-show flow, webhooks)
> blijft in de interne engines. Eén consistente buitenwereld, één interne werkelijkheid.

## Basis-URL

```
https://lbhtztbpxmqlzhyephew.supabase.co/functions/v1/public_api
```

## Authenticatie

Iedere request vereist de header:

```
X-TableWise-Api-Key: tw_live_...
```

Sleutels worden beheerd in **TableWise → Integraties → Hub**.
Een sleutel is altijd gekoppeld aan één vestiging. `locationId` in de body is optioneel
en wordt geweigerd als hij afwijkt van de vestiging van de sleutel
(`TW_403_TENANT_MISMATCH`).

Sleutels hebben **scopes**: `availability`, `book`, `cancel`, `update`. Mist een scope →
`TW_403_SCOPE_MISSING`.

---

## 1. Beschikbaarheid

```
POST /availability
```

**Body**
```json
{
  "locationId": "<uuid>",
  "localDate": "2026-05-01",
  "localTime": "19:30",
  "partySize": 4
}
```

**Response 200**
```json
{
  "isAvailable": true,
  "isAvailableWithWaitlist": false,
  "requestedSlot": { "localDate": "2026-05-01", "localTime": "19:30", "available": true, "peakWarning": false },
  "availableSlots": [
    { "localTime": "18:30", "available": true, "peakWarning": false },
    { "localTime": "19:00", "available": true, "peakWarning": false },
    { "localTime": "19:30", "available": true, "peakWarning": false }
  ],
  "suggestedAlternatives": [
    { "localTime": "19:15", "peakWarning": false },
    { "localTime": "19:45", "peakWarning": true }
  ],
  "reason": null
}
```

`reason` is een [TW-foutcode](./PUBLIC_API_ERROR_CODES.md) wanneer het gevraagde slot niet beschikbaar is
(bv. `TW_409_TIMESLOT_UNAVAILABLE`, `TW_409_PARTY_TOO_LARGE`, `TW_423_RESTAURANT_CLOSED`).

---

## 2. Reservering aanmaken

```
POST /reservations
```

**Body**
```json
{
  "locationId": "<uuid>",
  "localDate": "2026-05-01",
  "localTime": "19:30",
  "partySize": 4,
  "contact": {
    "fullName": "Willem van Oranje",
    "phone": "+31612345678",
    "email": "willem@example.nl",
    "language": "nl"
  },
  "notes": "Hoekje graag",
  "source": "voice_agent",
  "externalReference": "vapi_call_abc123"
}
```

Verplicht: `localDate`, `localTime`, `partySize`, `contact.fullName` (of `contact.firstName` + `contact.lastName`), `contact.phone`.
Optioneel: `contact.email`, `notes`, `language`, `source`, `externalReference`.

`source` mapt naar het interne `channel`:
- `voice_agent`, `phone_ai`, `vapi`, `retell`, `highlevel` → `ai_host`
- `whatsapp`, `sms`, `webchat`, `clickwise` → `clickwise`
- `phone`, `manual_phone` → `phone`
- `walk_in` → `walk_in`
- `manager`, `staff_entry` → `manager`
- onbekend → `online`

**Response 201**
```json
{
  "status": "confirmed",
  "reservationId": "11111111-1111-1111-1111-111111111111",
  "reservationCode": "AB23CD45",
  "localDate": "2026-05-01",
  "localTime": "19:30",
  "partySize": 4,
  "guest": { "fullName": "Willem van Oranje", "phone": "+31612345678", "email": "willem@example.nl" },
  "links": {
    "self":   "https://.../public_api/reservations/11111111-...",
    "update": "https://.../public_api/reservations/11111111-...",
    "cancel": "https://.../public_api/reservations/11111111-...",
    "guestManage": "https://txtablewise.lovable.app/manage/<token>"
  }
}
```

---

## 3. Reservering wijzigen

```
PATCH /reservations/{reservationId}
```

Alle velden optioneel — stuur alleen wat wijzigt.

```json
{
  "localDate": "2026-05-01",
  "localTime": "20:00",
  "partySize": 5,
  "notes": "Tafel 2 graag",
  "contact": { "phone": "+31612345679" }
}
```

Wijziging van datum/tijd/personen triggert opnieuw tafeltoewijzing en conflict-check.
Bij volle bezetting: `TW_409_TIMESLOT_UNAVAILABLE`.

---

## 4. Reservering annuleren

```
DELETE /reservations/{reservationId}?reason=Gast belde af
```

Of via body:
```json
{ "reason": "Gast belde af" }
```

**Response 200**
```json
{ "status": "cancelled", "reservationId": "...", "reason": "Gast belde af" }
```

---

## Foutformaat

Alle fouten hebben dezelfde vorm:

```json
{
  "error": {
    "code": "TW_400_MISSING_DATE",
    "message": "Datum ontbreekt.",
    "field": "localDate",
    "suggestedFix": "Voeg 'localDate' toe in formaat YYYY-MM-DD."
  }
}
```

Volledige tabel: zie [PUBLIC_API_ERROR_CODES.md](./PUBLIC_API_ERROR_CODES.md).

---

## cURL-voorbeelden

**Beschikbaarheid**
```bash
curl -X POST https://lbhtztbpxmqlzhyephew.supabase.co/functions/v1/public_api/availability \
  -H "Content-Type: application/json" \
  -H "X-TableWise-Api-Key: tw_live_..." \
  -d '{"localDate":"2026-05-01","localTime":"19:30","partySize":4}'
```

**Boeken**
```bash
curl -X POST https://lbhtztbpxmqlzhyephew.supabase.co/functions/v1/public_api/reservations \
  -H "Content-Type: application/json" \
  -H "X-TableWise-Api-Key: tw_live_..." \
  -d '{
    "localDate":"2026-05-01","localTime":"19:30","partySize":4,
    "contact":{"fullName":"Willem van Oranje","phone":"+31612345678"},
    "source":"voice_agent","externalReference":"vapi_call_abc123"
  }'
```

**Annuleren**
```bash
curl -X DELETE "https://lbhtztbpxmqlzhyephew.supabase.co/functions/v1/public_api/reservations/<id>?reason=Gast+belde+af" \
  -H "X-TableWise-Api-Key: tw_live_..."
```
