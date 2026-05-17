## Wat de screenshots bevestigen

De ClickWise action `reservation_request` faalt met:

- `success: false`
- `message: CAP action execution failed`
- `status: 401`
- `statusText: Unauthorized`

Dit is geen fout in de reserveringsregels, groepsgrootte of handmatige goedkeuring. De action komt niet door de gateway heen en bereikt onze `agent_api` code niet. Daardoor zegt de agent daarna zelf “technisch probleem”.

## Waarschijnlijke oorzaak

De deployed `agent_api` endpoint verwacht nu een `Authorization` header voordat de functie mag starten. ClickWise stuurt alleen de custom header `X-Agent-Api-Key`, of stuurt die niet als echte HTTP-header door. Daardoor blokkeert de runtime de call met `UNAUTHORIZED_NO_AUTH_HEADER` vóórdat onze eigen API-key validatie kan draaien.

## Plan

1. **`agent_api` opnieuw deployen met externe-tool toegang actief**
   - Controleren dat `verify_jwt = false` voor `agent_api` daadwerkelijk actief is op de live deploy.
   - Daarna `agent_api` opnieuw deployen.
   - Dit blijft veilig: de functie valideert zelf server-side op `X-Agent-Api-Key` tegen de gehashte sleutel in de database.

2. **De live endpoint direct testen**
   - Een echte `reservation_request` call uitvoeren op de gedeployde endpoint.
   - Verwachte uitkomst: geen 401 meer; bij ontbrekende velden hooguit een normale function-response zoals `missing_field`, en bij volledige data een normale reserveringsresponse.

3. **ClickWise setup-instructies harder maken**
   - In de admin setup-pagina expliciet toevoegen dat elke action twee headers moet hebben:
     - `X-Agent-Api-Key: {{custom_values.tablewise_api_key}}`
     - `Content-Type: application/json`
   - Als ClickWise/CAP alsnog een Authorization-header eist, toevoegen als fallback:
     - `Authorization: Bearer {{custom_values.tablewise_api_key}}`
   - Duidelijk markeren dat `tablewise_api_key` niet leeg mag zijn in de sub-account custom values.

4. **Troubleshooting blok toevoegen voor exact deze fout**
   - Bij `401 Unauthorized` / `CAP action execution failed`:
     - controleer of `tablewise_api_key` gevuld is;
     - controleer of de headers op de action staan, niet alleen in de body;
     - controleer of `Authorization` fallback nodig is;
     - daarna opnieuw testen met `reservation_request`.

5. **Geen businesslogica wijzigen**
   - Geen wijzigingen aan groepsdrempels.
   - Geen wijzigingen aan handmatige goedkeuring.
   - Geen wijzigingen aan tafellogica of beschikbaarheid.

## Acceptatiecheck

Na implementatie moet een ClickWise testcall niet meer eindigen op `401 Unauthorized`. Voor 16 personen moet de response daarna weer een normale `message_for_guest` teruggeven, met “nog geen definitieve reservering” wanneer handmatige goedkeuring nodig is.