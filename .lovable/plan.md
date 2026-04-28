
# Doel

Eén logging-dashboard onder **Beheer / Integraties / Logs** dat per inbound call (API, AI Voice Agent, ClickWise, widget, webhook, dashboard) toont wat er gebeurde, waarom het faalde, en — wanneer veilig — een retry-knop biedt. Foutoorzaken worden automatisch gesuggereerd.

# Aanpak in één zin

We voegen een nieuwe tabel `integration_logs` toe (apart van bestaande `integration_events` voor outbound), een gedeelde edge-function helper die request/response veilig logt met masking en `possible_cause`, hooks in `public_api` / `agent_api` / `dispatch_webhooks`, en een nieuwe pagina onder `/app/integrations/logs`.

# Wat we bouwen

## 1. Database — nieuwe tabel `integration_logs`

Bewust **niet** misbruiken van `integration_events` (dat is outbound queue voor ClickWise) of `audit_log` (entity-mutaties).

```
id uuid pk
restaurant_id uuid not null
created_at timestamptz default now()
source text not null         -- dashboard|widget|voice_agent|clickwise|api|webhook
action text not null         -- check_availability|create_reservation|update_reservation|cancel_reservation|webhook_delivery|other
status text not null         -- success|warning|failed
http_status int
latency_ms int
error_code text              -- TW_-codes of provider-codes
error_message text
possible_cause text          -- auto-gegenereerd op basis van error_code/payload
request_payload jsonb        -- ALTIJD gemaskeerd opgeslagen
response_payload jsonb       -- ALTIJD gemaskeerd opgeslagen
guest_id uuid
reservation_id uuid
api_key_prefix text          -- alleen prefix (12 chars), nooit hele key
external_reference text
retry_safe boolean default false
metadata jsonb default '{}'
```

Indexen op `(restaurant_id, created_at desc)`, `(restaurant_id, status)`, `(restaurant_id, source)`, `(reservation_id)`, `(guest_id)`.

RLS: `members read integration_logs` (`is_restaurant_member`), `manager write integration_logs` (alleen voor in-app retry-acties; edge functions schrijven via service role en omzeilen RLS).

## 2. Shared helper `supabase/functions/_shared/integration-log.ts`

Eén `logIntegration()` functie die:
- Diep cloned + maskeert: `phone` → `+31••••••89`, `email` → `j••@•••.com`, `password`/`token`/`api_key`/`secret` → `***`, `X-TableWise-Api-Key` header → eerste 12 chars + `…`.
- Limiteert payload-grootte tot 8 KB (truncatie + `_truncated: true`).
- Genereert `possible_cause` op basis van `error_code`:
  - `TW_400_MISSING_DATE` → "Datum ontbreekt in payload"
  - `TW_400_MISSING_TIME` → "Tijd ontbreekt"
  - `TW_400_MISSING_PARTY_SIZE` → "Aantal personen ontbreekt"
  - `TW_400_INVALID_PHONE` → "Telefoonnummer niet in geldig formaat (verwacht +31...)"
  - `TW_409_TIMESLOT_UNAVAILABLE` → "Tijdslot zit vol — bied alternatief of wachtlijst aan"
  - `TW_409_PARTY_TOO_LARGE` → "Groep groter dan max online — vereist handmatige goedkeuring"
  - `TW_401_*` → "API-sleutel ongeldig of ingetrokken"
  - `TW_404_*` → "Reservering niet gevonden"
  - webhook 5xx/timeout → "Endpoint offline of antwoordt niet"
  - webhook 4xx → "Veldmapping klopt niet of payload geweigerd"
- Schrijft async ("fire-and-forget" via `EdgeRuntime.waitUntil` of `.catch(noop)`) zodat de hot path niet vertraagt.

## 3. Hooks in bestaande edge functions

- **`public_api`** — log na elke route in de bestaande `try/catch` (zowel succes als faal): source `api`, action mapped uit pad, http_status, latency, error_code/message uit `twError`. Geen tweede try/catch — alleen één regel toevoegen vóór elke return.
- **`agent_api`** — zelfde patroon: source `voice_agent`, action uit pad, key_prefix gederiveerd uit X-Agent-Api-Key.
- **`dispatch_webhooks`** — log per delivery: source `webhook`, action `webhook_delivery`, target = endpoint URL, response_payload = body (truncated). Markeer `retry_safe: true` voor webhook-deliveries.
- **`book_reservation` / `manage_reservation`** — niet aanraken; ze worden indirect geraakt via `public_api`. (Dit voorkomt dubbele logs.)

## 4. Frontend

- **`src/services/integrationLogs.ts`** — `listLogs(restaurantId, filters, page)`, `retryLog(logId)`, `getLog(id)`, type-definities.
- **`src/pages/app/IntegrationLogsPage.tsx`** —
  - Filters bovenaan: datum-range (default laatste 24h), status (success/warning/failed), source (multi), error_code (vrije tekst), zoek op gast/reservering (id of naam via join).
  - Tabel-rijen met linker statusbalk (groen/oranje/rood). Kolommen: tijd, source-badge, action, status, error_code, gast/reservering, retry-knop (alleen als `retry_safe`).
  - Detail-drawer: volledige (gemaskeerde) request + response in JSON-blok, possible_cause-card, links naar gast/reservering/api-key.
  - Retry-knop: roept `retry_log` edge function aan die alleen voor whitelisted actions herexecuteert (`check_availability` en `webhook_delivery`). `create_reservation` retry is geblokkeerd om dubbels te voorkomen — i.p.v. retry tonen we "Maak handmatig aan" met pre-filled link naar `/app/reservations/new`.
- **Routing & nav**:
  - Route `/app/integraties/logs` in `src/App.tsx`.
  - Link in `AppSidebar.tsx` onder bestaande Integraties-sectie ("Logs").
  - Knop "Bekijk logs" in `IntegrationHubPage` Overview-tab.

## 5. Nieuwe edge function `retry_log`

Klein, één bestand:
- Authenticatie via user JWT (alleen managers van het restaurant).
- Laadt log, valideert `retry_safe = true`.
- Voor `check_availability` → re-runt tegen `availability` engine (read-only, géén side effects).
- Voor `webhook_delivery` → re-fetcht naar opgeslagen target met origineel payload.
- Schrijft een nieuwe `integration_logs` regel met `metadata.retry_of = <oude id>`.
- Weigert alle andere actions met duidelijke message.

## 6. Performance & veiligheid

- Async logging (waitUntil) zodat API-latency ongewijzigd blijft.
- 8 KB payload-cap voorkomt dat grote bodies de DB belasten.
- API-keys nooit volledig: alleen `key_prefix` (eerste 12 chars).
- Telefoon/email/secrets gemaskeerd vóór insert.
- Retry-functie is whitelisted; `create_reservation`/`update_reservation`/`cancel_reservation` zijn nooit retry-safe.

# Wat we NIET aanraken

- Bestaande `integration_events` tabel (outbound ClickWise queue) blijft.
- Bestaande `audit_log` tabel (entity-mutaties) blijft.
- Bestaande `agent_call_logs` (telefonie-summary) blijft — dat is een ander concern (kosten/transcript).
- `book_reservation` / `manage_reservation` core logic.

# Open vraag

Wil je in fase 1 ook de **dashboard-acties** loggen (handmatige reservering aanmaken in /app), of houden we dat buiten scope (die staan al in `audit_log`) en focussen we puur op externe calls?
