
## Antwoord op je vraag

**Ja, twee aanpassingen nodig in ClickWise** — en daarna update van de master-snapshot.

Reden: jij merkt terecht op dat `{{location.timezone}}` niet werkt in een Voice AI prompt. Datzelfde geldt in de praktijk ook voor `{{location.name}}` binnen prompts en — afhankelijk van de workflow-stap — soms in SMS-bodies. HighLevel exposeert `{{location.*}}` betrouwbaar alleen in beperkte contexten; in Voice AI prompts en Custom Action bodies moeten we op `{{custom_values.*}}` leunen.

De huidige TableWise → ClickWise sync pusht alleen:

- `tablewise_base_url`
- `tablewise_restaurant_id`
- `tablewise_webhook_secret`
- `tablewise_api_key`

Die set is te smal: restaurantnaam en tijdzone ontbreken, en de prompts/SMS verwijzen nu naar `{{location.*}}` die in het Voice kanaal niet rendert.

## Wat we toevoegen

**Twee nieuwe custom_values, automatisch gepusht door TableWise:**

1. `tablewise_restaurant_name` — uit `restaurants.name`
2. `tablewise_timezone` — uit `restaurants.timezone` (bv. `Europe/Amsterdam`)

Deze worden zowel bij `clickwise_provision_subaccount` (nieuwe sub-account) als bij `clickwise_sync_custom_values` (bestaande sub-account, knop "Custom Values syncen") gepusht. Bestaande sub-accounts krijgen ze er met één klik bij — geen handmatig werk per klant.

## Wijzigingen per laag

**Backend (sync/provision):**

- `supabase/functions/_shared/clickwise-hl.ts` → `buildCustomValues()` accepteert `restaurantName` + `timezone` en zet ze in de output.
- `supabase/functions/clickwise_provision_subaccount/index.ts` → geeft `r.name` en `r.timezone` mee.
- `supabase/functions/clickwise_sync_custom_values/index.ts` → laadt `name, timezone` extra uit `restaurants` en geeft ze mee.

**Master-snapshot UI (`AdminClickWiseVoiceSetupPage.tsx`):**

- System prompt: `{{location.name}}` → `{{custom_values.tablewise_restaurant_name}}`, `{{location.timezone}}` → `{{custom_values.tablewise_timezone}}`.
- First message: zelfde vervanging.
- SMS-bodies in inbound-webhook workflows: `{{location.name}}` → `{{custom_values.tablewise_restaurant_name}}` (consistent + safe in alle stappen).
- `customValuesSnapshot` placeholder-lijst uitbreiden met:
  - `tablewise_restaurant_name = REPLACE_PER_CLIENT`
  - `tablewise_timezone = REPLACE_PER_CLIENT` (bv. `Europe/Amsterdam`)
- Stappen-tekst: regel "Restaurantnaam + tijdzone hoef je niet meer als custom value te zetten" wordt vervangen door: "Worden automatisch gepusht door TableWise — niets handmatig nodig."

**Voice Agent Help (`VoiceAgentHelp.tsx`):**

- Alle prompt/first-message voorbeelden en de uitleg in Sectie 5/8 die nu `{{location.name}}` of `{{location.timezone}}` gebruiken → vervangen door de `{{custom_values.*}}` equivalenten, met korte noot dat `{{location.*}}` in Voice prompts niet rendert.

**Memory:**

- `mem://features/clickwise-snapshot` bijwerken: custom_values-set van 4 → 6 (naam + timezone erbij), opmerking dat snapshot prompts geen `{{location.*}}` meer gebruiken.

## Handmatige actie van jou in ClickWise (master sub-account)

Eénmalig in de master snapshot sub-account:

1. **Settings → Custom Values** → voeg toe (als ze er nog niet zijn):
   - `tablewise_restaurant_name` = `REPLACE_PER_CLIENT`
   - `tablewise_timezone` = `REPLACE_PER_CLIENT` (bv. `Europe/Amsterdam`)
2. **Voice AI Agent** → System Prompt + First Message: vervang `{{location.name}}` en `{{location.timezone}}` door de nieuwe `{{custom_values.*}}` referenties (de exacte teksten komen uit het bijgewerkte tabblad "Snapshot" in TableWise admin).
3. **Workflows (SMS-stappen)** → idem: `{{location.name}}` vervangen door `{{custom_values.tablewise_restaurant_name}}`.
4. **Snapshot opnieuw exporteren** zodat nieuwe klanten direct de juiste setup krijgen.

Voor bestaande klanten waar al een sub-account staat: één keer op de knop "Custom Values syncen" in TableWise → naam + timezone zijn gevuld, prompts werken.

## Custom Fields

**Geen aanpassingen nodig** aan ClickWise Custom Fields voor deze fix — contactvelden (`tw_reservation_id`, `tw_party_size`, etc.) blijven zoals ze zijn en worden via de inbound-webhook payload gevuld.

## Scope-bewaking

Geen logica-wijzigingen aan de Voice agent of booking-engine. Alleen: 2 extra waarden in de Custom Values push + alle prompt/SMS-templates wisselen van `{{location.*}}` naar `{{custom_values.*}}` + docs/snapshot bijwerken.
