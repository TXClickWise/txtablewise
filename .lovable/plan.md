## Wat er gebeurde

De twee SMSes om 02:35 en 02:38 zijn **niet** veroorzaakt door de mislukte testcall — er is in die periode geen reservering aangemaakt (database is leeg voor Eigeweis op 17 mei). Ze komen van twee aparte klikken op de **"Test"-knop** bij je webhook-endpoint in `/app/integraties/hub`:

- elke klik op die knop laat de `integration_test` edge-function een **echt** `POST` doen naar de geconfigureerde ClickWise inbound-webhook URL met een sample `reservation.created` payload;
- ClickWise voert de productie-automation gewoon uit en stuurt dus een echte SMS;
- de tekst noemt **Texels Biercollectief / 16 mei / 17:00 / 6 personen** omdat dat de placeholder-`{{custom_values.*}}`-waardes zijn in de master ClickWise sub-account (zie memory _ClickWise snapshot-ready_) — niet jouw Eigeweis-data.

De payload bevat al `test: true` en de header `X-TableWise-Test: true`, maar de ClickWise-automation kijkt daar niet naar, dus er gaat alsnog een SMS uit.

## Plan — drie lagen, samen oplossen

### 1. UI: bevestigingsdialog vóór elke "Test"-klik

`src/pages/app/IntegrationHubPage.tsx` — `handleTestWebhook`:
- vervang de directe call door een `AlertDialog` met copy:
  > "Dit verstuurt een echt webhook-event naar ClickWise. Afhankelijk van je automation kan dit een echte SMS, WhatsApp of e-mail veroorzaken. Doorgaan?"
- knoppen: **Annuleren** (default) / **Ja, verstuur test-event**.
- voeg een 30s lokale rate-limit toe per endpoint (`useRef` of state-map) zodat een dubbelklik niet twee SMSes triggert.

### 2. Edge function: dry-run-optie

`supabase/functions/integration_test/index.ts` — webhook-actie:
- accepteer extra body-param `dry_run: boolean` (default `false`).
- bij `dry_run === true`: skip de `fetch(ep.url, …)` en sla de **payload** + "(dry-run, niet verzonden)" op in `last_test_response_body`. Geef hetzelfde response-shape terug zodat de UI een preview kan tonen.

`src/services/integrations.ts` en de UI: voeg naast de "Test"-knop een **"Preview payload"**-knop toe (`dry_run: true`). Daarmee kan iemand de exacte JSON inspecteren zonder ClickWise te triggeren.

### 3. Docs: ClickWise-zijde (handmatige stap voor klant)

Update `src/pages/app/help/VoiceAgentHelp.tsx` (en het Integratiehub-helpblok) met een korte sectie:
> **Test-events filteren in ClickWise** — voeg vóór elke verzendactie een If/Else toe die het pad afsluit als `{{inboundWebhookRequest.payload.test}}` gelijk is aan `true`. TableWise zet die vlag automatisch bij elk test-event.

Geen code-wijziging in `dispatch_webhooks` of `agent_api`.

## Resultaat

- Dubbele/onbedoelde SMSes door knopdruk zijn niet meer mogelijk zonder expliciete bevestiging.
- Wie alleen de payload-structuur wil zien kiest "Preview payload" en triggert niets in ClickWise.
- Eén keer een If/Else toevoegen in ClickWise per automation maakt test-events permanent stil — ook als straks anderen op "Test" drukken.
