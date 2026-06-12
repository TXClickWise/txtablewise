# TableWise Agent API Contract

De `agent_api` Supabase edge function is de gateway voor externe voice agents zoals ClickWise / HighLevel Voice AI.

Base endpoint:

```text
{{custom_values.tablewise_base_url}}/agent_api
```

Authenticatie:

```text
X-Agent-Api-Key: {{custom_values.tablewise_api_key}}
Authorization: Bearer {{custom_values.tablewise_anon_key}}
Content-Type: application/json
```

## Algemene principes

1. De voice agent stuurt alleen gestructureerde input.
2. De TableWise engine beslist over reserveringsregels.
3. De agent spreekt `message_for_guest` uit.
4. De agent volgt `next_action`.
5. De agent bevestigt alleen definitief als `confirmed === true`.
6. Responses mogen geen interne data bevatten die de gast niet hoeft te horen.

## POST /agent_api/reservation_request

Nieuwe reserveringsaanvraag. Centrale action voor alle nieuwe voice-reserveringen.

### Request

```json
{
  "date": "2026-05-25",
  "time": "19:00",
  "party_size": 2,
  "guest": {
    "first_name": "Jeroen",
    "last_name": "van Rossum",
    "phone": "+31612345678",
    "email": "jeroen@example.com",
    "language": "nl"
  },
  "special_requests": "Graag een rustige tafel indien mogelijk.",
  "prefers_terrace": false,
  "language": "nl",
  "channel": "voice",
  "source_metadata": {
    "source_channel": "phone_ai",
    "provider": "highlevel"
  }
}
```

`prefers_terrace` (optioneel, boolean): zet op `true` als de gast expliciet vraagt
om buiten / op het terras te zitten. De agent vraagt **niet** naar specifieke
zone-namen. Het systeem probeert dan een terrastafel; als die niet beschikbaar
is (vol, dicht of weer ongunstig), wordt automatisch een passende tafel binnen
toegewezen.

### Required fields

- `date`
- `time`
- `party_size`
- `guest.first_name`
- `guest.phone`

`guest.email` mag ontbreken. De backend kan een technische placeholder gebruiken voor telefonische boekingen.

### Success: confirmed booking

```json
{
  "ok": true,
  "confirmed": true,
  "reservation_id": "uuid",
  "confirmation_code": "ABCD1234",
  "requires_manual_approval": false,
  "status_label": "definitief",
  "message_for_guest": "Top, jullie tafel staat genoteerd.",
  "next_action": "confirm_booking",
  "forbidden_phrases": []
}
```

### Success: pending approval

```json
{
  "ok": true,
  "confirmed": false,
  "reservation_id": "uuid",
  "requires_manual_approval": true,
  "status_label": "voorlopig",
  "message_for_guest": "Uw aanvraag is voorlopig genoteerd. Het restaurant laat het u zo snel mogelijk weten.",
  "next_action": "confirm_pending_approval",
  "forbidden_phrases": ["geboekt", "bevestigd", "gelukt", "rond", "definitief", "akkoord", "goedgekeurd"]
}
```

### Large group transfer

```json
{
  "ok": false,
  "confirmed": false,
  "next_action": "transfer_call",
  "transfer": {
    "allowed": true,
    "phone": "+31201234567"
  },
  "message_for_guest": "Een moment, ik verbind u door met een collega.",
  "forbidden_phrases": ["geboekt", "bevestigd", "gelukt", "rond", "definitief", "akkoord", "goedgekeurd"]
}
```

### Large group callback/follow-up

```json
{
  "ok": false,
  "confirmed": false,
  "next_action": "promise_callback",
  "message_for_guest": "Uw aanvraag is voorlopig genoteerd. Het restaurant laat het u zo snel mogelijk weten.",
  "forbidden_phrases": ["geboekt", "bevestigd", "gelukt", "rond", "definitief", "akkoord", "goedgekeurd"]
}
```

### Common error/next_action mapping

| error_code | next_action | Agent behavior |
|---|---|---|
| `placeholder_name_blocked` | ask missing name | Vraag echte voornaam |
| `missing_field` | ask missing field | Vraag ontbrekend veld |
| `message_required` | `ask_special_requests` | Vraag toelichting |
| `slot_too_soon` | `ask_later_time` | Vraag later tijdstip |
| `beyond_booking_horizon` | `ask_closer_date` | Vraag eerdere datum |
| `no_table_available` | `offer_alternatives_or_waitlist` | Alternatieven/wachtlijst |
| `slot_unavailable` | `offer_alternatives_or_waitlist` | Retry 1x indien `retry: true` |
| `pacing_limit_reached` | `offer_alternatives_or_waitlist` | Alternatieven/wachtlijst |
| `internal` | `apologize_and_callback` | Fallback |

## POST /agent_api/check_availability

Alleen voor informatievragen.

### Request

```json
{
  "date": "2026-05-25",
  "party_size": 2,
  "preferred_time": "19:00",
  "language": "nl",
  "channel": "voice"
}
```

### Response

```json
{
  "preferred_time": "19:00",
  "available": true,
  "can_book_exact": true,
  "exact": { "time": "19:00" },
  "alternatives": [{ "time": "18:30" }, { "time": "20:15" }],
  "closed": false,
  "large_group": false,
  "message": null,
  "next_action": "book_now"
}
```

Beschikbaarheid is geen boeking. Voor daadwerkelijke reservering moet de agent daarna `reservation_request` gebruiken.

## POST /agent_api/find_reservation

Zoekt bestaande reservering voor wijzigen/annuleren.

### Request

```json
{
  "phone": "+31612345678",
  "date": "2026-05-25",
  "language": "nl",
  "channel": "voice"
}
```

of:

```json
{
  "first_name": "Jeroen",
  "last_name": "van Rossum",
  "date": "2026-05-25",
  "time": "19:00",
  "language": "nl",
  "channel": "voice"
}
```

### Response

```json
{
  "success": true,
  "action": "find_reservation",
  "matches": [
    {
      "reservation_id": "uuid",
      "date": "2026-05-25",
      "time": "2026-05-25T17:00:00.000Z",
      "party_size": 2,
      "status": "confirmed",
      "guest_first_name": "Jeroen"
    }
  ],
  "message_for_guest": "Ik heb je reservering gevonden voor 2 personen."
}
```

## POST /agent_api/update_reservation

Wijzigt bestaande reservering na expliciete bevestiging.

### Request

```json
{
  "reservation_id": "uuid",
  "confirmed_by_guest": true,
  "new_date": "2026-05-26",
  "new_time": "19:30",
  "new_party_size": 4,
  "notes": "Graag een rustige tafel indien mogelijk.",
  "language": "nl",
  "channel": "voice"
}
```

### Response

```json
{
  "success": true,
  "action": "update_reservation",
  "message_for_guest": "Je reservering is bijgewerkt."
}
```

Aandachtspunt voor implementatie: controleer dat `new_time` correct wordt gemapt naar de interne `start_time_local` parameter van `manage_reservation`.

## POST /agent_api/cancel_reservation

Annuleert bestaande reservering na expliciete bevestiging.

### Request

```json
{
  "reservation_id": "uuid",
  "reason": "Geannuleerd via voice-agent",
  "language": "nl",
  "channel": "voice"
}
```

### Response

```json
{
  "ok": true,
  "reservation": {
    "id": "uuid",
    "status": "cancelled"
  }
}
```

## POST /agent_api/create_waitlist_entry

Maakt wachtlijstverzoek aan.

### Request

```json
{
  "guest": {
    "first_name": "Jeroen",
    "last_name": "van Rossum",
    "phone": "+31612345678",
    "email": "jeroen@example.com"
  },
  "desired_date": "2026-05-25",
  "party_size": 2,
  "desired_time_from": "18:00",
  "desired_time_to": "21:00",
  "notes": "Flexibel rond etenstijd.",
  "language": "nl",
  "channel": "voice"
}
```

### Response

```json
{
  "success": true,
  "action": "create_waitlist_entry",
  "waitlist_entry_id": "uuid",
  "message_for_guest": "Je staat op de wachtlijst. Als er plek vrijkomt, laat het restaurant het je weten."
}
```

## POST /agent_api/log_call

Logt het gesprek.

### Request

```json
{
  "outcome": "booked",
  "summary": "Nieuwe reservering voor twee personen op 25 mei om 19:00.",
  "reservation_id": "uuid",
  "language": "nl",
  "caller_phone": "+31612345678",
  "callee_phone": "+31201234567",
  "agent_id": "highlevel-agent-id",
  "duration_seconds": 95,
  "transcript_url": "https://...",
  "channel": "voice"
}
```

### Response

```json
{
  "ok": true,
  "external_call_id": "optional"
}
```

## Security

- Nooit service role keys in HighLevel zetten.
- `tablewise_api_key` alleen als secret/custom value gebruiken.
- `tablewise_anon_key` is nodig voor Supabase gateway en is niet de TableWise auth-laag.
- De echte autorisatie gebeurt via `X-Agent-Api-Key`.

## Multi-language

Alle actions mogen `language` ontvangen:

```text
nl | de | en
```

De agent moet in dezelfde taal spreken als de beller. De backend moet op termijn `message_for_guest` taalbewust teruggeven. Tot die tijd moet de prompt extra voorzichtig zijn met letterlijk voorlezen van Nederlandse fallbackteksten in Duitse/Engelse gesprekken.
