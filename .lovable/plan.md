# ClickWise snapshot — minder Custom Values, meer dynamiek

Doel: het master-snapshot in ClickWise moet voor een nieuwe klant met zo min mogelijk handmatige stappen werken. Drie aanpassingen.

## 1. Restaurantnaam via `{{location.name}}`

In ClickWise is `{{location.name}}` een ingebouwd sub-account veld dat automatisch de naam van de sub-account bevat. Door dit te gebruiken in plaats van een Custom Value:

- Geen handmatige `TW Restaurant Name` per klant meer invullen
- Werkt automatisch zodra de sub-account naam = restaurantnaam

**Wijzigingen in de help-/setup-documentatie:**
- `src/pages/app/help/VoiceAgentHelp.tsx` (regels 314-316, 344, 428, 443): vervang elke `{{custom_values.tw_restaurant_name}}` door `{{location.name}}` en verwijder de "TW Restaurant Name" rij uit de Custom Values lijst (sectie 4).
- `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx` (regels 73, 267, 274, 645, 989, 1019, 1020): idem voor `{{custom_values.restaurant_name}}`.

**Voorwaarde voor de operator (1 zin in de docs toevoegen):** "Zet bij het aanmaken van de ClickWise sub-account de naam exact gelijk aan de restaurantnaam in TableWise — die naam wordt overal automatisch ingevuld."

## 2. Tijdzone via `{{location.timezone}}`

Ook `timezone` is een standaard ClickWise location-veld (gevuld bij het aanmaken van de sub-account). 

- `VoiceAgentHelp.tsx` regel 317: vervang de hardcoded `CopyRow "TW Timezone" "Europe/Amsterdam"` door een uitleg-blokje: "Tijdzone wordt automatisch uit de ClickWise sub-account gehaald via `{{location.timezone}}` — zet die juist bij het aanmaken."
- Overal waar de prompt of een tool-body een tijdzone refereert → `{{location.timezone}}` i.p.v. `{{custom_values.tw_timezone}}`.

Resultaat: één handmatige stap minder per klant.

## 3. `TW Max Party Online` dynamisch uit TableWise

Custom Values in ClickWise zijn statisch en moeten per sub-account ingesteld worden. Beter is om de limiet **server-side** te leveren zodat hij altijd matcht met `restaurants.max_party_size_online`.

Twee complementaire stappen:

**A. Engine geeft de limiet terug (al deels het geval — maken expliciet).**
- In `supabase/functions/availability/index.ts`: voeg `restaurantConfig: { maxPartyOnline, bookingHorizonDays, timezone }` toe aan elk response. De agent kan dan in de prompt-instructie zien "als party_size > maxPartyOnline → vertel gast dat collega terugbelt".
- `supabase/functions/agent_api/index.ts` (check_availability + book_reservation): bij `party_size > max_party_size_online` retourneer een duidelijke fout `TW_409_PARTY_TOO_LARGE` met `maxPartyOnline` in de body, zodat de agent dat in z'n antwoord kan citeren.

**B. Optioneel: nieuwe lichte tool `get_restaurant_config` (GET, geen body) die `{ name, timezone, maxPartyOnline, bookingHorizonDays }` teruggeeft. De agent roept hem aan in de begroeting/eerste turn en gebruikt de waarden in z'n redenering.** Dit haalt ook de hardcoded `8` uit de prompt.

**Docs-wijziging:**
- `VoiceAgentHelp.tsx` sectie 4 regel 319: verwijder `TW Max Party Online` uit de Custom Values lijst.
- Sectie 8 regels 445-450 (Callout): herschrijf — "De grens komt automatisch uit TableWise (`max_party_size_online`). De agent leest hem bij elke call uit de API; pas hem aan in TableWise → Instellingen → Reserveringsregels."
- Sectie 9 tools: voeg `get_restaurant_config` toe of beschrijf hoe `check_availability` de limiet teruggeeft.

## Resulterend snapshot-checklist per nieuwe klant

Van 6 handmatige Custom Values → **2**:
1. `TW Agent API URL` (constant, kan zelfs hardcoded in tool-URLs)
2. `TW Agent API Key` (per klant uniek — onvermijdbaar)
3. `TW Webhook Secret` (per klant uniek — onvermijdbaar)

Plus: sub-account naam exact gelijk aan restaurantnaam zetten, en timezone correct kiezen in ClickWise sub-account.

## Update geheugen

Werk `mem://features/clickwise-snapshot` bij: restaurant_name + timezone gaan via `{{location.*}}`, max_party komt uit de engine response — niet meer als custom value.

## Buiten scope

- Geen wijzigingen aan reservering- of widget-logica
- Geen nieuwe tabellen
- ClickWise master-snapshot zelf updaten is een handmatige stap die de operator buiten Lovable doet — wij leveren alleen de juiste docs/templates.
