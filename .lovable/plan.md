
# Doel

Eén heldere AI Voice Agent flow-pagina in TableWise die externe agents (ClickWise, Vapi, Retell) dwingt tot de juiste 6-staps volgorde: gather → normalize → check availability → book → confirm → fallback. Plus een in-app "Test complete voice reservation flow" knop die exact dezelfde flow uitvoert tegen onze eigen `public_api`.

# Aanpak in één zin

We voegen een nieuwe **"Flow"** tab toe aan `VoiceAgentPage`, een nieuwe service `src/services/voiceFlow.ts` met normalisatie + flow-runner bovenop de bestaande `public_api`, en een uitgebreide prompt-template die de stappen afdwingt. Niets aan `agent_api`, `public_api`, of de bestaande Voice Agent tabs wordt vervangen.

# Wat we bouwen

## 1. Nieuw bestand: `src/services/voiceFlow.ts`

- **Normalisatiehelpers** (lokaal, geen LLM):
  - `normalizeDate("morgen" | "1 mei" | "01-05-2026" | ...)` → `YYYY-MM-DD`
  - `normalizeTime("half acht" | "19:30" | "19.30")` → `HH:MM`
  - `normalizePartySize("vier" | "4 personen")` → `number`
  - `normalizePhone("06 12345678" | "0031...")` → `+31...` (E.164)
- **`runVoiceFlow(restaurantId, input)`** voert deze 6 stappen uit en retourneert per stap `{ ok, message, errorCode?, field?, data? }`:
  1. **gather** — controleert of alle verplichte velden zijn ontvangen.
  2. **normalize** — converteert ruwe spraakinput naar API-formaat.
  3. **availability** — POST `public_api/availability`. Als niet beschikbaar → toont alternatieven, stopt vóór boeken.
  4. **book** — POST `public_api/reservations` met genormaliseerde payload + `source: "voice_agent"` + `externalReference: "flow-test-..."`.
  5. **confirm** — bouwt bevestigingsregel met datum/tijd/personen/naam/reserveringscode.
  6. **fallback** — bij elke faal: concrete instructie wat de agent zou moeten zeggen.
- **Tijdelijke API-key voor de in-app test**: omdat `public_api` `X-TableWise-Api-Key` vereist en wij alleen hashes opslaan, maakt de runner aan het begin een eenmalige sleutel aan in `agent_api_keys` (label `Voice flow test ...`, scope `availability+book+cancel`), gebruikt hem, en trekt hem direct daarna in (`revoked_at`). Sleutel wordt nooit getoond in de UI.
- **`VOICE_FLOW_FIELDS`** — single source of truth voor de tabel "wat verzamelt de agent" met `payloadField`-mapping (gebruikt door de UI).
- **`VOICE_FLOW_PROMPT_TEMPLATE`** — kant-en-klare Nederlandse prompt die exact deze flow afdwingt en TW_-foutcodes noemt.

## 2. Wijziging: `src/pages/app/VoiceAgentPage.tsx` (tab "Flow" toevoegen)

Niets verwijderen. Eén nieuwe tab tussen "Configuratie" en "API-sleutels":

- **Sectie "Velden & mapping"** — tabel uit `VOICE_FLOW_FIELDS`:
  | Veld | Verplicht | Voorbeeld | Payload-veld | Notitie |
  Verplichte velden krijgen een rode badge, optionele een grijze.
- **Sectie "Stappen"** — visuele 6-staps lijst (1. Gather → 6. Fallback) met korte uitleg per stap.
- **Sectie "Prompt voor je agent"** — `VOICE_FLOW_PROMPT_TEMPLATE` in een `<pre>` met copy-knop. Aparte sub-knop "Kopieer als ClickWise system prompt" (zelfde tekst, andere toast).
- **Sectie "Test complete voice reservation flow"**:
  - Compact formulier: spokenDate, spokenTime, spokenParty, firstName, lastName, phone, notes (defaults gevuld met realistisch voorbeeld zodat 1 klik voldoende is).
  - Knop "Voer flow uit". Tijdens uitvoering: spinner.
  - Resultaat: tijdlijn van de 6 stappen met ✓/✗-iconen, foutcode (TW_*) en `field` indien aanwezig, en de eind-bevestiging met reserveringscode.
  - Persistentie: `localStorage` `voiceFlow:lastResult:<rid>` zodat "laatste testresultaat" en "laatste foutmelding" bij paginarefresh zichtbaar blijven.
- **Veiligheid**: testreserveringen worden gemarkeerd via `externalReference: flow-test-<timestamp>` en `source_metadata.via=public_api`. We boeken bewust géén droge run — een echte reservering geeft de meest realistische test (operator kan hem in /app annuleren). Ik markeer dit duidelijk in de UI: "Dit maakt een echte reservering — annuleer hem na de test."

## 3. Geen wijzigingen aan

- `agent_api` (bestaande externe endpoint blijft werken voor wie hem al gebruikt).
- `public_api` (de flow gebruikt 'm zoals hij is).
- Database/RLS (we hergebruiken `agent_api_keys`).
- Andere tabs van `VoiceAgentPage`.

# UX-eisen check

- ✓ Welke velden verplicht — rode badge in de mapping-tabel.
- ✓ Welke velden de agent verzamelt — kolom "Spreekvoorbeeld".
- ✓ Welke velden gekoppeld zijn aan de payload — kolom "Payload-veld".
- ✓ Laatste testresultaat — opgeslagen in localStorage, getoond als groene kaart bovenaan testsectie.
- ✓ Laatste foutmelding — als laatste run faalde, rode kaart met TW_-code + field + suggestedFix.
- ✓ Knop "Test complete voice reservation flow" — primary button, met disclaimer over echte reservering.

# Guardrails check

- ✓ Geen externe workflow verplicht — TableWise voert de complete flow zelf uit via `public_api`.
- ✓ Geen reservering bij faal — runner stopt na elke fout, vóór de book-stap.
- ✓ Geen book vóór availability — book-stap is conditioneel op `availability.ok && data.isAvailable`.

# Open vraag

De testflow maakt een **echte reservering** (zodat we tafeltoewijzing/pacing/webhooks meetesten). Wil je dat liever:
- A. Echte reservering, met grote disclaimer + "Annuleer test-reservering"-knop in resultaat (voorstel).
- B. Droge run: alleen availability checken, book overslaan en simuleren.
