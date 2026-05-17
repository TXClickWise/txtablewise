## Diagnose

De recente live logs tonen geen `reservation_request` of `book_reservation` call voor 15 personen. Dat betekent dat de ClickWise voice agent waarschijnlijk zelf de `Call Transfer` action kiest voordat TableWise überhaupt wordt aangeroepen.

Daarnaast vond ik nog twee structurele risico’s:

- De admin setup noemt op sommige plekken nog “4 tools” en `book_reservation` als hoofdtool, terwijl `reservation_request` nu de primaire route moet zijn.
- `book_reservation` kan voor groepen tussen `large_group_threshold` en `large_group_manual_approval_from` `large_group_status = 'approved'` opslaan. Dat past wel in de database, maar veroorzaakt eerder al constraint-gerelateerde ruis bij grote-groep flows. Dit wil ik meteen opschonen naar consistente grote-groep statussen.

## Plan

1. **ClickWise setup hard corrigeren**
   - Alle plekken in de admin setup aanpassen van “4 tools” naar de juiste set met `reservation_request` als primaire boekingstool.
   - De workflow YAML en stappenplan aanpassen zodat `reservation_request` expliciet gekoppeld wordt.
   - `book_reservation` duidelijk markeren als legacy/back-up, niet meer als tool die standaard aan de agent gekoppeld hoeft te worden.

2. **Call Transfer niet meer als standaard voice-agent tool tonen**
   - In de setup-instructie opnemen: voeg `Call Transfer` niet toe als autonome intent/tool voor reserveringen.
   - Als ClickWise een transfer-action vereist, deze alleen gebruiken achter een workflow/condition op `response.next_action == "transfer_call"`.
   - Hierdoor kan de LLM niet zelf beslissen om 15 personen door te verbinden.

3. **Prompt nog strakker maken voor 1–18 personen**
   - In de system prompt expliciet toevoegen: voor `party_size <= {{custom_values.tablewise_large_group_max_online_request}}` of, als custom value ontbreekt, t/m 18 personen: altijd `reservation_request`, nooit Call Transfer.
   - De enige geldige transfer-trigger blijft: TableWise response `next_action: "transfer_call"`.

4. **Action JSON verbeteren voor realistische ClickWise velden**
   - `reservation_request` body robuuster maken met `external_call_id` in `source_metadata`, maar zonder te suggereren dat `agent_provider` nodig is.
   - Optioneel extra custom value `tablewise_large_group_max_online_request = 18` opnemen zodat de prompt per restaurant snapshot-ready blijft.

5. **Backend fallback extra beveiligen**
   - `reservation_request` zo aanpassen dat een response met `next_action: "transfer_call"` alleen kan terugkomen als `party_size > large_group_max_online_request`.
   - Als `book_reservation` onverhoopt `large_group_required_manual` teruggeeft voor `party_size <= large_group_max_online_request`, zet `reservation_request` dit om naar een gastvriendelijke callback/handmatige-aanvraag response zonder transfer.

6. **Database-status consistentie herstellen**
   - In `book_reservation` geen `large_group_status = 'approved'` meer zetten voor groepen die géén handmatige goedkeuring nodig hebben; laat dit `null`.
   - Alleen `awaiting_approval` gebruiken wanneer er echt interne beoordeling nodig is.

7. **Verificatie**
   - Test de deployed `agent_api/reservation_request` route met Eigeweis voor 15 personen.
   - Verwachte uitkomst: óf `ok:true` met `requires_manual_approval:true`, óf bij capaciteitstekort `offer_alternatives_or_waitlist`; nooit `transfer_call` voor 15 personen.
   - Controleer daarna de `integration_logs` op een echte `create_reservation` call.