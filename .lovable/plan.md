# Integratiehub voor TableWise — Plan

## Doel
Eén heldere **Integratiehub** die externe systemen (ClickWise, Voice Agents, WhatsApp/SMS bots, CRM) snel en foutloos laat koppelen. Bouwt **bovenop** bestaande modules — geen rewrite van `agent_api`, `clickwise_process_event`, `manage_reservation` of `book_reservation`.

## Wat er al is (behouden)
- `/app/integraties` — overzichtshub (cards) met links naar ClickWise + POS
- `/app/integraties/clickwise` — volledig ClickWise paneel (mappings, events, payload preview)
- `/app/voice-agent` — AI Voice Agent setup (provider, mode, agent_id, telefoon, system-prompt, API-keys, calls log, how-to)
- `/app/help/voice-agent` — copy-paste handleiding
- `agent_api_keys` tabel + `agent_api` edge function (sleutel-auth, scopes, last_used)
- `dispatch_webhooks` edge function + `restaurants.webhook_url/secret` (één endpoint per restaurant)
- `integration_events` queue + UI

## Wat er ontbreekt (kernpijn)
1. **Geen multi-webhook** — slechts 1 URL per restaurant in `restaurants`-tabel; geen event-filter per endpoint, geen test-knop, geen response-log.
2. **Geen end-to-end testknoppen** voor `check_availability` en `book_reservation` vanuit UI.
3. **Geen unified hub-pagina** — sleutelbeheer zit alleen onder Voice Agent; webhook-config zit verstopt in `instellingen/integraties`.
4. **Foutmodel uniformeren** — `agent_api` geeft platte `{error}`, `book_reservation` geeft platte `{error}`. Externe partijen zoals Voice Agents loggen die als generieke 4005/2016. Geen stabiele `error_code` enum.
5. **Voice Agent veld-checklist & volgorde** ontbreken explicit.

---

## Scope deze ronde

### A) Database — additief, geen breaking change
Nieuwe tabel `webhook_endpoints` (per-restaurant, meerdere endpoints met event-filter):
```text
webhook_endpoints
  id uuid pk
  restaurant_id uuid
  label text                -- "ClickWise productie", "n8n test"
  url text
  secret text                -- HMAC sha256 sign payload
  events text[]              -- subset van EVENT_TYPES of ['*']
  is_active bool default true
  created_at, updated_at
  last_test_at, last_test_status text, last_test_response text
RLS: manager read/write
```
Bestaande `restaurants.webhook_url/secret` blijft staan (backward compat). `dispatch_webhooks` leest **eerst** `webhook_endpoints` (per event filteren), valt terug op `restaurants.webhook_url` als er geen actieve endpoints zijn. Geen migratie van bestaande data nodig.

EVENT_TYPES (vast in code, niet in DB):
`reservation.created`, `reservation.updated`, `reservation.cancelled`, `reservation.no_show`, `reservation.seated`, `reservation.completed`, `guest.created`, `guest.updated`, `waitlist.created`, `review.received`.

### B) Edge functions — minimale, niet-brekende wijzigingen
1. `dispatch_webhooks/index.ts` — uitbreiden met `webhook_endpoints` lookup + per-endpoint event-filter. Bestaand pad blijft werken.
2. Nieuwe `integration_test/index.ts` — server-side proxy die UI-testknoppen veilig kan triggeren:
   - `POST /integration_test/webhook` — verstuurt sample payload naar 1 endpoint, logt response in `webhook_endpoints.last_test_*`
   - `POST /integration_test/availability` — wrapper rond bestaande `availability` met de sleutel-flow van `agent_api` (test als-of-een-voice-agent)
   - `POST /integration_test/book` — idem voor `book_reservation`, schrijft naar sandbox (channel = `ai_host`, `source_metadata.test = true`), zodat het in rapportages te filteren is
3. `agent_api` + `book_reservation` — voeg gestandaardiseerd antwoord toe **zonder bestaand contract te breken**: bestaande `error` blijft, daarnaast `error_code` (enum: `missing_field`, `invalid_email`, `slot_too_soon`, `slot_unavailable`, `party_size_too_large`, `large_group_required_manual`, `auth_invalid`, `auth_scope_missing`, `not_found`, `internal`) en `field` (welk veld faalde). Externe agents loggen dit i.p.v. raw text.

### C) UI — nieuwe pagina + uitbreidingen

**Nieuwe pagina `/app/integraties/hub`** (tabs):
1. **Overzicht** — statuskaarten per koppeling (ClickWise / Voice Agent / Webhooks / POS) met groene/grijze badge en "Beheren"-knop. Hergebruik `IntegrationCard`.
2. **API-sleutels** — verplaats het `agent_api_keys` beheer uit `VoiceAgentPage` naar deze tab als gedeelde component `<ApiKeysPanel/>` (Voice Agent pagina rendert dezelfde component → niets breekt). Toont label, prefix `tw_voice_xxx…`, scopes, last_used, ingetrokken-status. Maskering: alleen prefix + `…`. Genereer/intrekken-acties als nu.
3. **Webhooks** — CRUD op `webhook_endpoints`. Per endpoint:
   - Label, URL, secret (gemaskeerd na opslaan, "Toon" knop)
   - Multi-select events
   - **Test-knop** → roept `integration_test/webhook` met sample payload, toont status + truncated response in card
   - Toggle actief/inactief
4. **ClickWise** — link naar bestaande `/app/integraties/clickwise` + samenvatting (mode, contact-sync, laatste test).
5. **Voice Agent setup** — link naar `/app/voice-agent` + samenvatting + nieuwe **veld-checklist sectie** (zie D).
6. **Live test** — twee knoppen:
   - "Test beschikbaarheid" — formulier (datum/aantal) → `integration_test/availability` → toont resultaat
   - "Test reservering aanmaken" — formulier (datum/tijd/aantal/voornaam/telefoon/email) → `integration_test/book` → toont reservation_id + link naar reservering. Markeert reservering met `source_metadata.test = true`.

Sidebar: voeg menu-item **Integratiehub** toe onder "Beheer" (naast bestaande "Integraties"). Bestaande `/app/integraties` blijft als overzicht-cards bestaan voor mensen die dat gewend zijn.

### D) Voice Agent — veld-checklist + voorbeeldconfig
Nieuwe sectie op `/app/voice-agent` (en in `/app/help/voice-agent`):
**Verplichte velden** (in deze volgorde, voor stabiele AI-flow):
1. `date` (YYYY-MM-DD) — verplicht
2. `time` (HH:MM, 24u) — verplicht
3. `party_size` (1-50) — verplicht
4. `guest.first_name` — verplicht
5. `guest.last_name` — aanbevolen
6. `guest.phone` (E.164) — aanbevolen
7. `guest.email` — optioneel (placeholder wordt gegenereerd indien leeg)
8. `special_requests` — optioneel

Daaronder een copy-paste blok met:
- Aanbevolen prompt-volgorde (1. begroeting → 2. datum → 3. tijd → 4. aantal → 5. voornaam → 6. telefoon → 7. bevestiging hardop → 8. tool call)
- JSON voorbeeld custom-action body (al deels in `VoiceAgentHelp`, hier compact)
- Foutcodes-tabel die de agent kan herkennen

### E) Foutcodes documentatie
Nieuw bestand `docs/INTEGRATION_ERROR_CODES.md` met enum + uitleg + suggested-recovery (naar gast en naar agent). Linkje vanuit hub-pagina.

---

## Bestanden die aangeraakt worden

| Bestand | Wijziging |
|---|---|
| `supabase/migrations/<new>.sql` | + tabel `webhook_endpoints` + RLS |
| `supabase/functions/dispatch_webhooks/index.ts` | + lookup `webhook_endpoints`, filter op event |
| `supabase/functions/integration_test/index.ts` | NIEUW — webhook/availability/book test-proxy |
| `supabase/functions/agent_api/index.ts` | + `error_code`/`field` in foutresponses (additief) |
| `supabase/functions/book_reservation/index.ts` | + `error_code` in foutresponses (additief) |
| `src/services/integrations.ts` | NIEUW — webhook_endpoints CRUD + test-aanroepen |
| `src/components/integrations/ApiKeysPanel.tsx` | NIEUW — geëxtraheerd uit VoiceAgentPage |
| `src/components/integrations/WebhookEndpointsPanel.tsx` | NIEUW |
| `src/components/integrations/LiveTestPanel.tsx` | NIEUW |
| `src/pages/app/IntegrationHubPage.tsx` | NIEUW — tab-pagina |
| `src/App.tsx` | + route `/app/integraties/hub` |
| `src/components/AppSidebar.tsx` | + menu-item "Integratiehub" |
| `src/pages/app/VoiceAgentPage.tsx` | API-keys tab vervangen door `<ApiKeysPanel/>`, veld-checklist toevoegen |
| `src/pages/app/help/VoiceAgentHelp.tsx` | + foutcodes-tabel + veldvolgorde |
| `docs/INTEGRATION_ERROR_CODES.md` | NIEUW |

## Wat we NIET doen (guardrails gerespecteerd)
- Geen wijziging aan `manage_reservation` engine
- Geen verwijdering van `restaurants.webhook_url` (blijft fallback)
- Geen verwijdering van bestaande `/app/integraties` of `/app/integraties/clickwise`
- Geen rewrite van `clickwise_process_event`
- Geen hardcoded secrets in UI; alleen prefix + maskering
- Geen automatische live webhook-calls; alleen via expliciete testknop
- Geen breaking change in bestaande `agent_api` JSON-contract — `error_code` is **toegevoegd**, `error` blijft

## Beveiliging
- `agent_api_keys` blijft sha256-hash; key alleen 1x getoond
- `webhook_endpoints.secret`: alleen managers kunnen lezen via RLS; UI toont `••••••••` met "Toon"-knop (eenmalige onthulling per sessie)
- `integration_test/book` schrijft echte reservering maar tagt `source_metadata.test = true` zodat hij filterbaar is in Reserveringen + niet meetelt in rapportages (apart filter toevoegen aan `reporting.ts` indien gewenst — buiten scope, alleen tag zetten)
- HMAC signing van webhook payloads blijft (`X-TableWise-Signature`)

## Volgorde / fasering bij implementatie
1. Migratie `webhook_endpoints` + RLS
2. `dispatch_webhooks` uitbreiden (achterwaarts compatibel)
3. `integration_test` edge function deployen
4. Service-laag `services/integrations.ts`
5. UI: `ApiKeysPanel` extracten + `WebhookEndpointsPanel` + `LiveTestPanel`
6. `IntegrationHubPage` met tabs samenstellen + route + sidebar
7. `agent_api` + `book_reservation` `error_code` toevoegen
8. Voice Agent veld-checklist + help-pagina updaten
9. `docs/INTEGRATION_ERROR_CODES.md`

## Vragen voor jou voor we starten
1. Wil je dat de **Test-reservering** echt in de database belandt (gemarkeerd als test) of alleen droog-gevalideerd worden zonder schrijven?
2. Moet ik bestaande `/app/integraties` (cards-overzicht) **vervangen** door de nieuwe Hub, of beide laten bestaan met een "Aanbevolen"-banner op de oude die naar de nieuwe verwijst?
3. Welke **events** wil je echt actief verwijzen in webhook-config? Mijn voorstel: alle 10 hierboven. Of alleen de eerste 6 (zoals in de opdracht)?
