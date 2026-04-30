## Doel

Voeg de volledige inbound-webhook-zijde toe aan de ClickWise admin setup-pagina, zodat ClickWise niet alleen TableWise *belt* (voice agent) maar ook *luistert* naar alle 11 events die TableWise vandaag uitstuurt. Volledig snapshot-ready.

## Achtergrond — wat TableWise nu al uitstuurt

Bron: `supabase/functions/dispatch_webhooks/index.ts` + `LIVE_ALLOWED_EVENTS` in `clickwise_process_event`.

TableWise POST naar elke geconfigureerde webhook URL met deze envelope:
```json
{ "id", "event_type", "restaurant_id", "created_at", "payload": {...} }
```
Headers: `X-TableWise-Event`, `X-TableWise-Event-Id`, `X-TableWise-Endpoint`, `X-TableWise-Signature` (HMAC-SHA256 met endpoint secret).

De 11 events die we ondersteunen:
- `reservation.created`, `reservation.updated`, `reservation.cancelled`
- `reservation.reminder_24h_scheduled`, `reservation.reminder_2h_scheduled`
- `reservation.reconfirmation_requested`, `reservation.reconfirmed`
- `review.requested`
- `waitlist.notification_requested`
- `guest.created`, `guest.updated`

## Wijzigingen in `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx`

### 1. Nieuwe constants
- `inboundEnvelope` — generiek voorbeeld van de body die TableWise altijd POST.
- `inboundEvents[]` — array van 11 event-objects met `key, label, purpose, suggestedAction, samplePayload`.

### 2. Nieuwe tab "Inbound webhooks" (tussen Workflow en Test)
TabsTrigger toevoegen met `Webhook` icoon (lucide-react). TabsContent bevat:

**Card A — Concept ("ClickWise luistert naar TableWise")**
- Korte uitleg van het 2-richtingen-verkeer: voice agent = ClickWise → TableWise; events = TableWise → ClickWise.
- Diagram-achtige kaart die duidelijk maakt: één Inbound Webhook trigger per event-type in ClickWise.

**Card B — Universele payload envelope**
- `CopyBlock` met `inboundEnvelope` zodat admin de structuur snapt vóór hij workflows bouwt.
- Uitleg headers: `X-TableWise-Event`, `X-TableWise-Signature`.

**Card C — Stap-voor-stap één event opzetten**
1. ClickWise → Automation → Workflow → New → trigger **Inbound Webhook**.
2. Workflow-naam: `TW — <event_label>` (consistent voor snapshot-herkenning).
3. Kopieer de unieke webhook URL die ClickWise toont.
4. Plak in TableWise → Settings → API & Webhooks → *Endpoint toevoegen*, met label = workflow-naam, event-filter = event-key.
5. (Optioneel) Generate webhook secret in TableWise → vul in ClickWise als header-validatie in een Custom Code-step.
6. Test via TableWise → "Stuur testevent" → controleer in ClickWise execution log.

**Card D — Lijst van 11 aanbevolen workflows (Accordion)**
Per event:
- Header: label + event-key code badge.
- Body: `purpose`, `suggestedAction`, `CopyBlock` met sample payload.

**Card E — HMAC-validatie (optioneel maar aanbevolen)**
- Korte uitleg dat HighLevel geen native HMAC heeft.
- Snippet voor een Custom Code-step die de `X-TableWise-Signature` header valideert tegen het endpoint secret.

### 3. Update Snapshot-tab (`snapshot` TabsContent)

**Wel-snapshot lijst uitbreiden:**
- "11 inbound-webhook workflows (logica blijft, URLs niet)"

**Niet-snapshot lijst uitbreiden:**
- "Inbound webhook URLs — uniek per sub-account, per klant kopiëren naar TableWise"

**Stappen-lijst uitbreiden van 6 naar 7:**
Stap 7 toevoegen: "Per inbound-workflow: kopieer de unieke ClickWise webhook URL en plak in TableWise → Settings → API & Webhooks (één endpoint per event-type, of één endpoint met `*` filter voor alles)."

**Tijdsindicatie aanpassen:** ~25-30 min per nieuwe klant.

### 4. Stappenplan-tab — extra StepCard

Tussen Step 7 (snapshot) en eventuele opvolgers, voeg StepCard 8 toe: "Inbound webhooks koppelen — TableWise laten praten naar ClickWise" met verwijzing naar de nieuwe Inbound webhooks tab.

### 5. Banner-update bovenaan
- Update de "Wat ga je opzetten?"-card: voeg bullet toe "11 inbound webhooks zodat TableWise bevestigingen, reminders en reviews automatisch laat versturen."

### 6. Memory update

Update `mem://features/clickwise-snapshot`:
- Toevoegen: 11 inbound-webhook-workflows zijn onderdeel van de snapshot; URLs niet.
- Stappen-aantal per nieuwe klant gaat van 6 naar 7.

## Niet in scope

- Geen wijzigingen aan `dispatch_webhooks`, `clickwise_process_event` of database — alleen documentatie/UI in admin-pagina.
- Geen automatische webhook-URL-sync (HighLevel API biedt dit niet via snapshots).
- Geen wijzigingen aan `ApiWebhooksSettings.tsx` — bestaande UI blijft de plek waar URLs ingevuld worden.

## Resultaat

System admin krijgt één centrale plek met:
- Volledige lijst van 11 events met purpose + sample payload.
- Stap-voor-stap inbound webhook setup.
- HMAC-validatie snippet.
- Snapshot-tab die nu álle 7 handmatige stappen per klant correct dekt.
