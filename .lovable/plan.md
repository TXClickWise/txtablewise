## Probleem dat ik heb gevonden

Er zitten twee echte oorzaken in de huidige setup:

1. **De voice-agent/API krijgt bij grote groepen niet dezelfde duidelijke uitkomst als de widget.**
   - De widget boekt 12 personen correct als reservering met `status=pending` en `large_group_status=awaiting_approval`.
   - De voice-agent moet dit ook doen, maar de prompt/API-response maakt het te makkelijk om bij grote groepen toch naar call transfer te gaan.
   - Call transfer hoort pas te gebeuren wanneer de groep **boven `large_group_max_online_request`** valt. Voor Eigeweis staat die nu op **18**, dus **12 personen moet gewoon worden geboekt met goedkeuring nodig**.

2. **Er is/was een backend-status mismatch voor grote groepen.**
   - Een recente voice-test met 10 personen faalde met: `reservations_large_group_status_check`.
   - Dat betekent dat een statuswaarde niet door de database werd geaccepteerd. Dit veroorzaakt precies de vicieuze cirkel: prompt lijkt goed, maar de boeking kan alsnog falen.

Daarnaast is er een promptprobleem rond tijd:
- De agent checkte bij “half zes” uiteindelijk `18:00`, terwijl de geboekte reservering pas na “17 uur 30” goed ging.
- De prompt moet daarom expliciet zeggen: **“half zes” = 17:30**, **niet 18:00**, en bij twijfel moet de agent vragen “bedoelt u half zes, dus vijf uur dertig?”

## Plan

### 1. Backend: één definitieve grote-groepen-reserveringsroute
Ik pas de engine zo aan dat `book_reservation` voor voice en widget exact dezelfde beslisboom afdwingt:

- `party_size < large_group_threshold` → normale reservering.
- `large_group_threshold <= party_size < large_group_manual_approval_from` → grote groep, direct geboekt, `large_group_status=approved`.
- `party_size >= large_group_manual_approval_from` én `party_size <= large_group_max_online_request` → reservering wordt **altijd aangemaakt** met:
  - `status=pending`
  - `requires_manual_approval=true`
  - `large_group_status=awaiting_approval`
- `party_size > large_group_max_online_request` → pas dan géén reservering, maar `TW_409_PARTY_TOO_LARGE` + transfer-info.

Voor Eigeweis betekent dit concreet:
- 8 personen → grote groep, direct geboekt of volgens ingestelde drempel.
- 12 personen → **reservering aanmaken, wacht op goedkeuring**.
- 19+ personen → pas dan call transfer/callback.

### 2. Backend: response uitbreiden zodat de voice-agent niet hoeft te gokken
Ik zorg dat `book_reservation` én `agent_api/book_reservation` expliciet teruggeven:

```json
{
  "ok": true,
  "reservation": { ... },
  "requires_manual_approval": true,
  "large_group_status": "awaiting_approval",
  "message_for_guest": "Voor een groep van twaalf personen leg ik uw aanvraag voor aan een collega..."
}
```

Daardoor hoeft de AI-agent niet zelf te interpreteren of hij moet boeken, goedkeuring noemen of doorverbinden.

### 3. Backend: status-mismatch oplossen
Ik herstel de mismatch die de constraint-fout veroorzaakt:

- Alleen toegestane waarden opslaan: `awaiting_approval`, `approved`, `declined`, etc.
- Geen verouderde of afwijkende statuswaarde meer vanuit code.
- Als er toch een fout komt, wordt die netjes gelogd met een duidelijke code in plaats van een onduidelijke 500.

### 4. Agent API: call transfer onmogelijk maken voor boekbare grote groepen
Ik pas `agent_api` aan zodat de voice-agent bij `book_reservation` nooit zelf op basis van groepsgrootte kan kiezen voor transfer zolang de engine een boekbare aanvraag accepteert.

- Transfer-info wordt alleen teruggegeven bij `party_size > large_group_max_online_request`.
- Bij 12 personen krijgt de agent dus geen transfer-route maar een succesvolle `pending` reservering.

### 5. Prompt: tijdherkenning “half zes” expliciet corrigeren
Ik scherp de system prompt en admin setup aan:

- Nederlands:
  - `half zes` = `17:30`
  - `half zeven` = `18:30`
  - `half acht` = `19:30`
- Niet interpreteren als “zes uur” of `18:00`.
- Bij twijfel: één korte controlevraag stellen:
  - “Bedoelt u half zes, dus vijf uur dertig?”
- Tool-call blijft altijd `HH:MM`.

### 6. Prompt: grote-groepen-flow onmiskenbaar maken
Ik vervang de huidige tekst “probeer altijd eerst te boeken” door een hardere instructie:

- **Nooit doorverbinden vóór `book_reservation` is geprobeerd.**
- Als `book_reservation` succesvol is met `requires_manual_approval=true`, dan:
  - gastvriendelijk melden dat de aanvraag in TableWise staat;
  - geen SMS/WhatsApp/e-mail beloven;
  - niet alsnog doorverbinden.
- Alleen bij `TW_409_PARTY_TOO_LARGE` mag call transfer.

### 7. UI/settings: dubbele labels “Goedkeuring nodig” + “Wacht op goedkeuring” opruimen
In de screenshot is zichtbaar dat één reservering twee bijna identieke badges krijgt:
- “Goedkeuring nodig”
- “Wacht op goedkeuring”

Ik maak dit eenduidig:
- Eén duidelijke badge: **“Wacht op goedkeuring”**.
- De andere technische/duplicerende badge verdwijnt voor operators.

### 8. Verificatie
Na implementatie controleer ik dit met echte backend-tests:

- `party_size=8`, `time=17:30` → boeking lukt.
- `party_size=12`, `time=17:30` → reservering wordt aangemaakt met `pending` + `awaiting_approval`, géén transfer.
- `party_size=19` → géén reservering, wel `TW_409_PARTY_TOO_LARGE` + transfer-info.
- Logs laten geen constraint-fout meer zien.
- Prompt bevat nergens meer belofte van persoonlijke bevestiging via SMS/WhatsApp/e-mail in de voice-afsluiting.

## Handmatige stap na livegang

Na de codefix moet de bijgewerkte prompt opnieuw naar de ClickWise voice-agent/master snapshot worden gekopieerd. Anders blijft de live voice-agent met de oude prompt werken, ook al is TableWise zelf gefixt.