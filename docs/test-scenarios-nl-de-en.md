# Voice AI Test Scenarios - NL / DE / EN

Gebruik deze testscenario's voordat een TableWise Voice AI Agent live gaat.

Test altijd eerst in sandbox-modus.

## Algemene acceptatiecriteria

De agent slaagt wanneer:

- hij de taal van de beller correct volgt
- hij nooit een reservering bevestigt zonder `confirmed === true`
- hij altijd een echte voornaam vraagt of bevestigt
- hij nooit placeholdernamen gebruikt
- hij altijd `reservation_request` gebruikt voor nieuwe boekingen
- hij grote groepen niet zelf beoordeelt
- hij Call Transfer alleen gebruikt na `next_action: transfer_call`
- hij wijzigingen en annuleringen pas uitvoert na expliciet akkoord
- hij `log_call` gebruikt aan het einde van het gesprek

## Nederlandse scenario's

### NL-01 - Nieuwe reservering, 2 personen

Beller:
"Ik wil graag reserveren voor twee personen morgen om zeven uur."

Verwacht gedrag:

1. Agent vraagt/controleert naam.
2. Agent gebruikt beller-ID of vraagt telefoonnummer.
3. Agent vat samen in spreektaal.
4. Agent vraagt akkoord.
5. Agent roept `reservation_request` aan.
6. Agent spreekt `message_for_guest` uit.

### NL-02 - Alleen beschikbaarheid vragen

Beller:
"Hebben jullie vanavond nog plek voor twee om half acht?"

Verwacht gedrag:

1. Agent gebruikt `check_availability`.
2. Agent zegt niet dat er geboekt is.
3. Agent vraagt of de beller wil reserveren.
4. Bij ja: normale `reservation_request` flow.

### NL-03 - Grote groep

Beller:
"Ik wil reserveren voor vijftien personen zaterdag om zeven uur."

Verwacht gedrag:

1. Agent verzamelt gegevens.
2. Agent beoordeelt zelf niet of 15 te groot is.
3. Agent vraagt akkoord.
4. Agent roept `reservation_request` aan.
5. Agent volgt `next_action`.
6. Als `confirmed === false`, gebruikt agent geen woorden zoals geboekt/bevestigd/definitief.

### NL-04 - Naam ontbreekt

Beller geeft datum, tijd en aantal, maar geen naam.

Verwacht gedrag:

1. Agent vraagt expliciet om voornaam.
2. Agent gebruikt geen "Gast" of "Onbekend".
3. Bij backend error `placeholder_name_blocked` vraagt agent opnieuw naar echte voornaam.

### NL-05 - Wijzigen reservering

Beller:
"Ik wil mijn reservering van morgen wijzigen van twee naar vier personen."

Verwacht gedrag:

1. Agent zoekt reservering via `find_reservation`.
2. Agent bevestigt gevonden reservering.
3. Agent vraagt akkoord voor wijziging.
4. Agent roept `update_reservation` aan met `confirmed_by_guest: true`.
5. Agent bevestigt wijziging alleen als tool slaagt.

### NL-06 - Annuleren reservering

Beller:
"Ik wil mijn reservering voor vanavond annuleren."

Verwacht gedrag:

1. Agent zoekt reservering via `find_reservation`.
2. Agent herhaalt reservering.
3. Agent vraagt expliciet akkoord.
4. Agent roept `cancel_reservation` aan.
5. Agent bevestigt annulering alleen als tool slaagt.

### NL-07 - Tijd in Nederlandse half-vorm

Beller:
"Doe maar half acht."

Verwacht gedrag:

- Agent interpreteert dit als 19:30.
- Tool input gebruikt `19:30`.

## Duitse scenario's

### DE-01 - Neue Reservierung

Caller:
"Ich möchte für zwei Personen morgen um sieben Uhr reservieren."

Expected behavior:

1. Agent speaks German.
2. Agent asks/confirms first name.
3. Agent summarizes in German.
4. Agent asks for explicit confirmation.
5. Agent calls `reservation_request` with `language: "de"`.
6. Agent does not mix Dutch into the conversation.

### DE-02 - Deutsche Halbzeit

Caller:
"Um halb acht bitte."

Expected behavior:

- Agent interprets `halb acht` as 19:30.
- Tool input uses `19:30`.

### DE-03 - Große Gruppe

Caller:
"Wir möchten für sechzehn Personen am Samstag reservieren."

Expected behavior:

1. Agent does not decide if the group is too large.
2. Agent collects details and confirmation.
3. Agent calls `reservation_request`.
4. Agent follows `next_action`.
5. If not confirmed, agent does not say `gebucht`, `bestätigt`, or `fest reserviert`.

### DE-04 - Stornieren

Caller:
"Ich möchte meine Reservierung stornieren."

Expected behavior:

1. Agent uses `find_reservation`.
2. Agent confirms the reservation details in German.
3. Agent asks for explicit cancellation confirmation.
4. Agent calls `cancel_reservation`.

## English scenarios

### EN-01 - New reservation

Caller:
"I'd like to book a table for two tomorrow at seven."

Expected behavior:

1. Agent speaks English.
2. Agent asks/confirms first name.
3. Agent summarizes the request.
4. Agent asks explicit confirmation.
5. Agent calls `reservation_request` with `language: "en"`.
6. Agent only confirms if `confirmed === true`.

### EN-02 - Availability only

Caller:
"Do you have a table for two tonight around seven?"

Expected behavior:

1. Agent uses `check_availability`.
2. Agent does not say the table is booked.
3. Agent asks whether the caller wants to submit a reservation.

### EN-03 - Ambiguous half seven

Caller:
"Half seven."

Expected behavior:

- Agent asks clarification: "Do you mean six thirty or seven thirty?"
- Agent does not guess.

### EN-04 - Change reservation

Caller:
"Can I change my booking from seven to seven thirty?"

Expected behavior:

1. Agent finds reservation first.
2. Agent summarizes old and new time.
3. Agent asks explicit confirmation.
4. Agent calls `update_reservation`.

## Error and edge cases

### ERR-01 - API error retry

Simulate backend error with retry allowed.

Expected behavior:

1. Agent says it will try once more.
2. Agent retries once.
3. If it fails again, agent uses fallback.
4. Agent logs outcome as `fallback_to_human`.

### ERR-02 - No table available

Engine returns `offer_alternatives_or_waitlist`.

Expected behavior:

1. Agent offers alternatives if provided.
2. If caller chooses alternative, agent summarizes and calls `reservation_request` again.
3. If caller wants waitlist, agent calls `create_waitlist_entry`.

### ERR-03 - Special request required

Engine returns `ask_special_requests`.

Expected behavior:

1. Agent asks for a short explanation.
2. Agent calls `reservation_request` again with `special_requests` filled.
3. Agent does not say booking is confirmed before engine confirms.

### ERR-04 - Transfer allowed

Engine returns:

```json
{
  "next_action": "transfer_call",
  "transfer": {
    "allowed": true,
    "phone": "+31..."
  }
}
```

Expected behavior:

1. Agent says `message_for_guest`.
2. Agent calls HighLevel Call Transfer.
3. Agent does not choose transfer by itself.

### ERR-05 - Transfer not allowed / callback flow

Engine returns `promise_callback`.

Expected behavior:

1. Agent says `message_for_guest`.
2. Agent does not invent extra callback promises.
3. Agent logs outcome correctly.

## Regression checklist

Run these before live:

- NL confirmed reservation
- NL pending approval large group
- NL no availability with alternatives
- NL waitlist
- NL update reservation
- NL cancel reservation
- DE confirmed reservation
- DE large group pending
- EN confirmed reservation
- EN ambiguous half-time clarification
- API error retry
- placeholder name blocked
- call transfer only after engine approval
- post-call logging
