## Probleem

De testpayload die je ontving komt **niet** uit `dispatch_webhooks` (waar ik de enrichment gebouwd heb), maar uit een aparte edge function `integration_test` — die wordt aangeroepen door de "Verstuur test"-knop in de Integratiehub. Die functie heeft een **hard-coded** sample payload die alleen `payload.reservation.{id,date,time,party_size,status,guest}` bevat. Geen `manage_token`, geen top-level `reservation_date`, geen top-level `party_size`, geen `manage_url`.

Daarom zie je in ClickWise wel `inboundWebhookRequest.payload.reservation.date` / `.time` / `.party_size`, maar niet de top-level varianten en niet `manage_token` / `manage_url`.

In **productie** (echte reservering geboekt → `dispatch_webhooks` → ClickWise) krijgt ClickWise wél de volledige enriched payload. De test ≠ echt.

## Plan

**1. `supabase/functions/integration_test/index.ts` — sample payload uitbreiden**

De hardcoded `samplePayload.payload` aanpassen zodat hij 1-op-1 dezelfde shape heeft als wat `dispatch_webhooks` nu naar ClickWise stuurt. Concreet toevoegen op top-level binnen `payload`:

- `reservation_id` (= `test-reservation-id`)
- `reservation_date` (vandaag/ morgen, ISO date)
- `reservation_time` (`"19:30"`)
- `start_time` (ISO timestamp)
- `party_size` (`2`)
- `status` (`"confirmed"`)
- `confirmation_code` (`"TW-TEST"`)
- `manage_token` (`"test-manage-token"`)
- `cancel_token` (`"test-cancel-token"`)
- `manage_url` (`https://.../r/{slug}/manage/test-manage-token`)
- `cancel_url` (`...?action=cancel`)
- `confirm_url` (`...?action=confirm`)
- `guest` (top-level kopie met `first_name/last_name/email/phone/language`)
- `restaurant` (`{ id, name, slug, timezone }`)

Het bestaande `reservation: { ... }` sub-object blijft staan voor backwards compatibility, maar wordt ook uitgebreid met `manage_token`, `cancel_token`, `manage_url`, `cancel_url`, `confirm_url`, `confirmation_code`.

Implementatie: voor de URL's haalt de test even het `restaurants`-record op (slug, public_base_url) — net zoals `dispatch_webhooks` dat doet — zodat de URL's klopt voor jouw restaurant. Als geen `public_base_url` is gezet → fallback naar `SITE_URL` env (`https://www.txtablewise.nl`).

**2. `supabase/functions/clickwise_process_event/index.ts` — controle**

Even nakijken of die ook gebruikt wordt voor test-events en of die ook enrichment nodig heeft, of dat alleen `dispatch_webhooks` het echte pad is voor ClickWise.

**3. Deploy & jij test opnieuw**

Na deploy klik je in /app/integraties opnieuw op "Verstuur test". Dan zie je in ClickWise (Inbound Webhook trigger → "View Sample Payload") alle nieuwe velden onder `inboundWebhookRequest.payload.*` en kun je je Find/Create Contact mapping afmaken met:

```
{{inboundWebhookRequest.payload.manage_token}}
{{inboundWebhookRequest.payload.manage_url}}
{{inboundWebhookRequest.payload.reservation_date}}
{{inboundWebhookRequest.payload.party_size}}
```

## Wat ik **niet** ga doen

- `dispatch_webhooks` aanpassen — daar zit de enrichment al goed in (vorige ronde).
- De UI-instructies in `VoiceAgentHelp.tsx` aanpassen — die zijn al correct (`{{inboundWebhookRequest.payload.*}}`).
- Logica van het echte webhook-pad veranderen.

Akkoord? Dan voer ik het uit.