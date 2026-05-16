## Doel

Sectie 9 ("Tool definities") in `src/pages/app/help/VoiceAgentHelp.tsx` zo maken dat je in ClickWise letterlijk veld-voor-veld kunt invullen wat er in de schermen "Query parameters" en "Data collection for query params and body params" hoort. En `update_reservation` promoten van "optioneel" naar volwaardige tool 4, want telefonisch wijzigen van reserveringen is een kernflow.

## Antwoord op je vraag over wijzigen

Ja — `update_reservation` bestaat al in `agent_api` (en in `AI_ACTION_CATALOG`), maar staat nu onderaan als "optioneel". Dat klopt niet met de realiteit van een telefonische gastvrouw: "kunnen we van 4 naar 6 personen?" of "kan het een uur later?" zijn standaard-vragen. Hij wordt opgewaardeerd naar Tool 4. `log_call` schuift door naar Tool 5.

## Tool-volgorde na de wijziging

1. `check_availability`
2. `create_reservation` (huidige naam in ClickWise; de edge function accepteert ook `book_reservation` als alias — we tonen `create_reservation` overal omdat dat matcht met je screenshots)
3. `cancel_reservation`
4. `update_reservation`  ← nieuw als verplichte tool
5. `log_call`

## Wat er per tool wordt getoond

Voor elke tool één compact blok met:

- **Description** (copy-knop) — exacte tekst die je in ClickWise plakt
- **URL** (copy-knop) — `${AGENT_API_BASE}/<tool_name>`
- **Method**: `POST`
- **Headers** (copy-blok): `X-Agent-Api-Key` + `Content-Type`
- **Query parameters**: expliciet "**Leeg laten**" (alle tools gebruiken alleen body)
- **Data collection for body params** — als invul-tabel met exact deze kolommen, identiek aan de ClickWise-UI:

  | Field name | Type | In | Required | Description (copy) | Example |

  Elke rij heeft een mini "kopieer"-knop voor de Description-cel, zodat je hem 1-op-1 in ClickWise plakt.

- **Voorbeeld-body (JSON)** met `{{custom_values.*}}` / `{{contact.*}}` placeholders
- **Response mapping** — welke velden de agent kan lezen (`result.slots[].time`, `result.reservation_id`, etc.)

## Exacte body-velden per tool (bron: `src/services/aiHost/contracts.ts` + `supabase/functions/agent_api/index.ts`)

**check_availability**
- `date` String body required — YYYY-MM-DD, reken vanaf `{{system__time_utc}}`
- `party_size` Number body required — geheel getal 1–8
- `preferred_time` String body optional — HH:mm 24u, alleen als beller specifieke tijd noemt

**create_reservation**
- `date` String body required — YYYY-MM-DD
- `time` String body required — HH:mm 24u
- `party_size` Number body required — 1–8
- `first_name` String body required
- `last_name` String body optional
- `phone` String body optional — E.164, bijv. +31612345678
- `email` String body optional
- `special_requests` String body optional — allergieën / gelegenheid / kinderstoel

**cancel_reservation**
- `reservation_id` String body required — UUID uit eerdere boeking of find_reservation
- `reason` String body optional — korte NL-reden

**update_reservation** (nieuw als hoofdtool)
- `reservation_id` String body required
- `new_date` String body optional — YYYY-MM-DD
- `new_time` String body optional — HH:mm
- `new_party_size` Number body optional — 1–8
- `special_requests` String body optional
- Description benadrukt: minimaal één van `new_date` / `new_time` / `new_party_size` invullen, anders niets te wijzigen. Eerst `check_availability` voor de nieuwe combinatie.

**log_call**
- `external_call_id` String body required — `{{call.id}}`
- `caller_phone` String body required — `{{contact.phone}}`
- `callee_phone` String body optional — `{{call.to_number}}`
- `outcome` String body required — enum: `booked` | `cancelled` | `updated` | `info_only` | `no_action` | `callback_needed`
- `reservation_id` String body optional — alleen bij booked/cancelled/updated
- `duration_seconds` Number body optional
- `summary` String body optional — max 2 NL-zinnen
- `agent_id` String body optional — vrij label

## Implementatiestappen

1. **`src/pages/app/help/VoiceAgentHelp.tsx`**
   - Nieuw klein component `ToolParamTable` (lokaal in dit bestand) dat de 6-koloms tabel rendert met per rij een copy-knop voor de Description-cel.
   - Sectie 9 herschrijven naar 5 tool-blokken in bovenstaande volgorde. Elk blok krijgt: Description-copy, URL-copy, "Query parameters: leeg laten"-regel, Headers code-blok, `ToolParamTable`, Body JSON-blok, Response-mapping uitleg.
   - "Optionele extra tools" sectie behouden, maar `update_reservation` daaruit verwijderen (verplaatst naar Tool 4). `find_reservation`, `reconfirm_reservation`, `create_waitlist_entry`, `get_opening_hours` blijven optioneel.
   - `buildBundle()` JSON uitbreiden: `update_reservation` URL toevoegen onder `tools`, en per tool een `params`-array meeleveren zodat één export alle 5 tools volledig dekt.
   - In sectie 5 ("System prompt") de regel over `log_call`-outcomes uitbreiden met `updated` en een korte flow-regel: "Bij verzoek tot wijzigen → `check_availability` voor nieuwe combinatie → `update_reservation` → bevestig hardop."
   - Sectie 8 ("ClickWise routing/setup") tekst die "4 Custom Webhook Actions" zegt → "5 Custom Webhook Actions".

2. **Geen wijzigingen in edge functions of contracts** — `update_reservation` werkt al server-side. Dit is puur een docs/UI-update.

## Niet doen

- Geen aanpassing aan `agent_api/index.ts`, `contracts.ts`, of database. Pure frontend/docs.
- Geen losse Loyverse-help (eerder besloten).
- `ClickWiseToolSetupPanel` blijft ongemoeid; dat genereert al automatisch uit het catalog.

## Verificatie achteraf

- Vergelijken met je screenshot van `check_availability` → de 3 velden in de tabel moeten 1-op-1 matchen met de "Data collection"-rijen.
- `buildBundle()`-export bevat nu 5 tool-URLs en per tool een `params`-array.
- Search in de help-pagina op "update_reservation" landt op het nieuwe Tool 4-blok.
