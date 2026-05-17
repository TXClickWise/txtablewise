## Probleembeeld

De 14-persoons test heeft alleen `check_availability` aangeroepen en daarna geen `book_reservation`. Dat betekent: de backend gaf beschikbaarheid terug, maar de live voice-agent/ClickWise flow stopte of koos een andere actie voordat er geboekt werd.

Daarnaast zie ik twee structurele risico’s die de vicieuze cirkel verklaren:

- `check_availability` stuurt nu een enorme lijst met alle slots terug. Bij grote groepen is dat veel ruis; de agent kan na beschikbaarheid verdwalen in de response en niet boeken.
- De action-templates zijn niet overal gelijk: in de admin setup mist `preferred_time` in de `check_availability` body, terwijl de backend dat juist vereist. Ook de oude helptekst bevat nog foutieve “SMS/WhatsApp bevestiging”-copy.

## Plan

1. **Maak een nieuwe “alles-in-één” voice booking route**
   - Voeg in `agent_api` een route `reservation_request` toe.
   - Deze route doet server-side in één call:
     1. input valideren,
     2. availability controleren,
     3. exact tijdslot matchen,
     4. reservering aanmaken,
     5. response teruggeven met één duidelijke `message_for_guest`.
   - Voor 11 t/m 18 personen bij Eigeweis wordt dus niet meer vertrouwd op de LLM om na availability nog apart book te doen.

2. **Gedrag grote groepen hard afdwingen in backend**
   - `party_size <= large_group_max_online_request` → nooit transfer; probeer boeken.
   - `party_size >= large_group_manual_approval_from` → boeking wordt `pending`, `requires_manual_approval=true`, `large_group_status=awaiting_approval`.
   - `party_size > large_group_max_online_request` → geen boeking, alleen dan `TW_409_PARTY_TOO_LARGE` met `transfer`-informatie.
   - Als een boeking 11–18 personen om availability-/tafelreden niet lukt, komt er géén call transfer maar een gastvriendelijke fallback met alternatieven of callback.

3. **Compacte availability-response voor voice**
   - Pas `agent_api/check_availability` aan zodat de voice-agent geen volledige slotlijst meer krijgt, maar alleen:
     - `exact`,
     - maximaal 3 `alternatives`,
     - `can_book_exact`,
     - `next_action`.
   - Dit verkleint de kans dat de agent stopt na availability.

4. **ClickWise setup omzetten naar één primaire booking action**
   - Update de admin prompt: voor nieuwe reserveringen gebruikt de agent bij voorkeur `reservation_request` in plaats van losse `check_availability` + `book_reservation`.
   - `check_availability` blijft alleen voor losse vraag “kan ik om X uur komen?” of wijzigingsflows.
   - Voeg action JSON toe voor `reservation_request`.
   - Herstel `check_availability` JSON in de admin setup met verplichte `preferred_time`.

5. **Prompt nog strakker maken tegen doorverbinden**
   - Nieuwe harde regel: bij groepsgroottes t/m `large_group_max_online_request` is Call Transfer verboden, ongeacht wat de agent denkt.
   - Alleen de backend-response `transfer.allowed=true` bij `TW_409_PARTY_TOO_LARGE` mag Call Transfer activeren.

6. **Oude tegenstrijdige help-copy opschonen**
   - Verwijder resterende “SMS/WhatsApp automatisch toegestuurd” tekst in `VoiceAgentHelp.tsx`.
   - Zorg dat alle voorbeelden dezelfde toolnamen, bodyvelden en beslisboom gebruiken.

7. **Verificatie met echte backend calls**
   - Test via deployed edge functions:
     - 8 personen → directe boeking/confirmed.
     - 14 personen → reservering aangemaakt met `pending`, `requires_manual_approval=true`, `large_group_status=awaiting_approval`.
     - 18 personen → idem, nog steeds géén transfer.
     - 19 personen → géén boeking, alleen transfer/callback-response.
   - Controleer in `integration_logs` dat bij 14 personen nu daadwerkelijk een create-reservation call ontstaat.

## Belangrijk na implementatie

Na deploy moet de ClickWise Eigeweis sub-account opnieuw worden bijgewerkt met de nieuwe prompt én de nieuwe `reservation_request` action. Zonder die update blijft de live agent de oude losse flow gebruiken.