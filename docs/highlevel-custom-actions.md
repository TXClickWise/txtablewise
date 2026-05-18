# HighLevel Custom Actions - TableWise Voice AI

Deze gids beschrijft de Custom Actions die in HighLevel / ClickWise moeten worden ingericht voor de TableWise Voice AI Agent.

## Basisinstellingen

Base URL:

```text
{{custom_values.tablewise_base_url}}/agent_api
```

Headers voor elke action:

```text
Content-Type: application/json
Authorization: Bearer {{custom_values.tablewise_anon_key}}
X-Agent-Api-Key: {{custom_values.tablewise_api_key}}
```

Let op: `X-Agent-Api-Key` is de echte TableWise agent-authenticatie. De anon key is nodig voor de Supabase edge gateway.

## Action: reservation_request

Nieuwe reserveringen moeten via deze action lopen. Dit is de centrale boekingspoort voor Voice AI.

Endpoint:

```text
POST {{custom_values.tablewise_base_url}}/agent_api/reservation_request
```

Body:

```json
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "party_size": 2,
  "guest": {
    "first_name": "Jeroen",
    "last_name": "van Rossum",
    "phone": "{{contact.phone}}",
    "email": "{{contact.email}}",
    "language": "nl"
  },
  "special_requests": "optioneel",
  "language": "nl",
  "channel": "voice",
  "source_metadata": {
    "source_channel": "phone_ai",
    "provider": "highlevel"
  }
}
```

Belangrijk:

- Nooit aanroepen zonder mondelinge bevestiging van de gast.
- Nooit met placeholder namen.
- Nooit zelf grote groepen beoordelen.
- De response bepaalt wat de agent zegt.

Belangrijke responsevelden:

```json
{
  "ok": true,
  "confirmed": true,
  "next_action": "confirm_booking",
  "message_for_guest": "...",
  "reservation_id": "...",
  "confirmation_code": "...",
  "forbidden_phrases": []
}
```

Mogelijke `next_action` waarden:

- `confirm_booking`
- `confirm_pending_approval`
- `transfer_call`
- `promise_callback`
- `offer_alternatives_or_waitlist`
- `ask_special_requests`
- `ask_later_time`
- `ask_closer_date`
- `apologize_and_callback`

## Action: check_availability

Alleen gebruiken voor beschikbaarheidsvragen zonder directe boekingsintentie.

Endpoint:

```text
POST {{custom_values.tablewise_base_url}}/agent_api/check_availability
```

Body:

```json
{
  "date": "YYYY-MM-DD",
  "party_size": 2,
  "preferred_time": "19:00",
  "language": "nl",
  "channel": "voice"
}
```

Belangrijk:

- Beschikbaarheid is geen boeking.
- Als de gast daarna wil boeken, alsnog `reservation_request` gebruiken.

## Action: find_reservation

Gebruik deze action altijd eerst bij wijzigen of annuleren.

Endpoint:

```text
POST {{custom_values.tablewise_base_url}}/agent_api/find_reservation
```

Body voorbeelden:

```json
{
  "phone": "{{contact.phone}}",
  "language": "nl",
  "channel": "voice"
}
```

```json
{
  "first_name": "Jeroen",
  "last_name": "van Rossum",
  "date": "YYYY-MM-DD",
  "time": "19:00",
  "language": "nl",
  "channel": "voice"
}
```

Response bevat `matches` met `reservation_id`.

## Action: update_reservation

Gebruik voor wijzigen nadat de juiste reservering gevonden is en de gast mondeling akkoord geeft.

Endpoint:

```text
POST {{custom_values.tablewise_base_url}}/agent_api/update_reservation
```

Body:

```json
{
  "reservation_id": "uuid",
  "confirmed_by_guest": true,
  "new_date": "YYYY-MM-DD",
  "new_time": "19:30",
  "new_party_size": 4,
  "notes": "optioneel",
  "language": "nl",
  "channel": "voice"
}
```

Belangrijk:

- Alleen aanroepen na expliciet akkoord.
- Niet beloven dat de wijziging gelukt is voordat de tool succes teruggeeft.
- Backend moet beschikbaarheid en pacing opnieuw valideren.

## Action: cancel_reservation

Gebruik voor annuleren nadat de juiste reservering gevonden is en de gast expliciet akkoord geeft.

Endpoint:

```text
POST {{custom_values.tablewise_base_url}}/agent_api/cancel_reservation
```

Body:

```json
{
  "reservation_id": "uuid",
  "reason": "Geannuleerd via voice-agent",
  "language": "nl",
  "channel": "voice"
}
```

## Action: create_waitlist_entry

Alleen gebruiken als de engine wachtlijst aanbiedt of toestaat en de gast akkoord geeft.

Endpoint:

```text
POST {{custom_values.tablewise_base_url}}/agent_api/create_waitlist_entry
```

Body:

```json
{
  "guest": {
    "first_name": "Jeroen",
    "last_name": "van Rossum",
    "phone": "{{contact.phone}}",
    "email": "{{contact.email}}"
  },
  "desired_date": "YYYY-MM-DD",
  "party_size": 2,
  "desired_time_from": "18:00",
  "desired_time_to": "21:00",
  "notes": "optioneel",
  "language": "nl",
  "channel": "voice"
}
```

## Action: get_opening_hours

Alleen voor algemene openingstijdenvragen. Niet gebruiken om reserveringsbeslissingen te nemen.

Endpoint:

```text
POST {{custom_values.tablewise_base_url}}/agent_api/get_opening_hours
```

Body:

```json
{
  "date": "YYYY-MM-DD",
  "language": "nl",
  "channel": "voice"
}
```

## Action: log_call

Aan het einde van elk gesprek aanroepen wanneer mogelijk.

Endpoint:

```text
POST {{custom_values.tablewise_base_url}}/agent_api/log_call
```

Body:

```json
{
  "outcome": "booked",
  "summary": "Nieuwe reservering voor twee personen op 25 mei om 19:00.",
  "reservation_id": "uuid",
  "language": "nl",
  "agent_id": "{{custom_values.highlevel_agent_id}}",
  "caller_phone": "{{contact.phone}}",
  "channel": "voice"
}
```

Outcomes:

- `booked`
- `changed`
- `cancelled`
- `no_action`
- `fallback_to_human`
- `pending_approval`
- `waitlist`

## Call Transfer

HighLevel Call Transfer mag alleen worden aangeroepen na deze engine-response:

```json
{
  "next_action": "transfer_call",
  "transfer": {
    "allowed": true,
    "phone": "+31..."
  }
}
```

De agent mag Call Transfer nooit zelf kiezen op basis van groepsgrootte.
