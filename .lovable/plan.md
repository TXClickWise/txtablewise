
# Zone fill-strategie ("vul-volgorde")

Doel: bij online, AI-voice, widget-links én walk-in suggesties wordt het restaurant in een instelbare volgorde gevuld, met drempel-gebaseerde overloop en condities per zone. Gasten kiezen geen zone, maar kunnen wél een **voorkeur terras** opgeven.

## 1. Datamodel (migratie)

Uitbreiding op `zones`:

- `fill_priority` (int, default 100) — lager = eerder vullen. Drag-volgorde in Instellingen schrijft hier.
- `fill_threshold_pct` (int, default 70) — zone "vol genoeg" → volgende zone openen.
- `min_party_size` (int, default 1)
- `max_party_size` (int, default 50)
- `active_weekdays` (text[], default alle 7) — zelfde keys als shifts: `mon..sun`.
- `active_time_from` (time, nullable) / `active_time_to` (time, nullable) — bv. Podium 19:00–23:00.
- `weather_dependent` (bool, default false) — voor Terras.
- `weather_min_temp_c` (numeric, nullable, default 16)
- `weather_blocks_on_precipitation` (bool, default true)
- `is_terrace` (bool, default false) — markeert welke zone(s) de "graag terras"-voorkeur kunnen vervullen.

Uitbreiding op `tables`:

- `fill_priority` (int, default 100) — sub-sortering bínnen een zone.

Uitbreiding op `reservations` (al deels aanwezig):

- `prefers_terrace` (bool, default false) — los van bestaande `zone_preference` zodat we het expliciet kunnen rapporteren.

Geen wijziging in RLS-modellen (gebruiken bestaande zones/tables policies). `update_updated_at` triggers blijven.

## 2. Weer-data

Voor MVP: dagelijkse fetch via een nieuwe edge-functie `weather_refresh` (cron) die per restaurant met lat/long de voorspelling van Open-Meteo (gratis, geen key) ophaalt en cachet in een nieuwe tabel `weather_forecasts (restaurant_id, date, min_temp_c, max_temp_c, precipitation_mm, fetched_at)`. Lookup synchroon in availability/book is dan goedkoop.

Edge-case: ontbrekende lat/long → behandel terras als "weer onbekend" → niet blokkeren, wel logger-event zodat owner ziet dat coördinaten ontbreken in Algemene instellingen.

## 3. Centrale selectie-helper

Nieuwe `supabase/functions/_shared/zone-fill.ts`:

- `resolveActiveZones({ zones, partySize, dateIso, tz, weather })` → gefilterde, gesorteerde lijst van zones die nú in aanmerking komen (op weekdag, tijdvenster, party-size, weer). Inactieve zones blijven beschikbaar voor combinatie-fallback maar krijgen score 0.
- `pickTableWithFillStrategy({ zones, tables, occupiedTableIds, partySize, currentOccupancyByZone, prefersTerrace })` → kiest één tafel-id (of triggert combinatie-fallback) met algoritme:
  1. Filter tafels op fit (capaciteit + niet bezet + zone actief voor deze context).
  2. Bereken voor elke kandidaat-zone huidige bezetting voor dat shift-venster.
  3. Voor elke zone in `fill_priority`-volgorde: als bezetting < `fill_threshold_pct` → deze zone is "primair". Alle volgende zones blijven secundair tot drempel gehaald is.
  4. Onder gelijke zone-prioriteit: kies tafel waarvan `capacity_max - party_size` minimaal is (best fit), daarna laagste `tables.fill_priority`, daarna alfabetisch label.
  5. `prefersTerrace = true` → zone met `is_terrace=true` krijgt prio-bonus die de fill-volgorde overrulet, mits zone actief is (weer/tijd/party-size). Als terras niet kan: normaal algoritme + flag `terrace_preference_unmet=true` op de reservering en in confirmation email.

## 4. Aanroepende plekken

- `supabase/functions/book_reservation/index.ts` — huidige "eerste vrije tafel" vervangen door `pickTableWithFillStrategy`. Combinatie-fallback blijft, maar combinaties krijgen hun zone-prioriteit van de zone van de eerste tafel.
- `supabase/functions/availability/index.ts` — geen functionele wijziging in slot-berekening (een slot blijft "beschikbaar" zolang ergens een tafel past), maar laat `available_table_count` filteren op zones-actief-nu zodat een slot dat alleen door geblokkeerde terras-tafels "vrij" lijkt, correct wordt gemarkeerd.
- `supabase/functions/agent_api/index.ts` (AI voice) — gebruikt al `book_reservation` onderwater → erft strategie automatisch. We voegen `prefers_terrace` toe aan het reservation-create contract en documenteren in `docs/agent-api-contract.md`.
- `src/components/walk-in/AIQuickSeatInput.tsx` + `src/lib/tableRecommendation.ts` — score-functie krijgt optionele `fillStrategy` parameter; default aan voor walk-in/quick-seat zodat suggesties dezelfde volgorde tonen. Reden-string laat zien "In primaire vul-zone" of "Terras-voorkeur gast".

## 5. UI

### Instellingen → Zones (`ZonesTablesSettings.tsx`)

- Drag-volgorde schrijft naar `fill_priority` (i.p.v. of náást huidige `sort_order` — `sort_order` blijft voor presentatie zoals tijdlijn-headers).
- Per zone een uitklap "Vul-regels":
  - Slider: vul tot %
  - Min/max gezelschap
  - Weekdagen-multiselect
  - Tijdvenster van/tot
  - Toggle "Weer-afhankelijk" + min temp + blokkeer bij neerslag
  - Toggle "Dit is een terras (gast kan voorkeur aangeven)"
- Tafel-rij: klein `fill_priority`-pijltje (omhoog/omlaag) onder de geavanceerde sectie.

### Widget (`src/components/public-booking/...`)

- Eén nieuw checkbox-veld in stap "Jouw gegevens": **"Graag op het terras zitten (indien mogelijk)"**. Alleen tonen als het restaurant ≥1 zone met `is_terrace=true` heeft.
- Confirmation kopie: bij `terrace_preference_unmet` warmhartige zin toevoegen ("We hebben helaas geen terrastafel meer vrij, maar zorgen voor een mooie plek binnen.").

### AI voice flow (`docs/highlevel-voice-agent-prompt.md`)

- Eén nieuwe agent-vraag: "Heeft u een voorkeur voor een terrastafel?" — wordt 1-op-1 doorgegeven als `prefers_terrace` boolean. Geen zone-namen noemen.

### Rapportage (`ReportsPage.tsx`)

- Nieuw blok "Zone-bezetting": per zone per shift bezet-% + aantal reserveringen, en KPI "Terras-voorkeur gehonoreerd" (n / totaal aanvragen).

## 6. Volgorde van uitvoering

1. Migratie (kolommen + `weather_forecasts` tabel + grants + indices op `zones(restaurant_id, fill_priority)`).
2. `_shared/zone-fill.ts` + unit tests in `src/test/` met fixture-data.
3. Wire-in in `book_reservation` (achter feature-flag `fill_strategy_enabled` op restaurant; default aan voor nieuwe, uit voor bestaande tot owner het zet).
4. Walk-in / quick-seat recommendation gebruikt zelfde helper.
5. `weather_refresh` edge-functie + cron in `docs/CRON_SETUP.md`.
6. UI in `ZonesTablesSettings` + widget checkbox + agent-prompt update.
7. Reporting blok.

## 7. Open vraagpunten (kan later)

- Combinatie-zones (tafels uit 2 zones samenvoegen): hangen aan zone met laagste prio van de gekozen tafels.
- Service-rotatie ("één serveerster per zone"): expliciet **niet** in deze iteratie, kan later als `assigned_staff_id` per zone.

## Memory-update na implementatie

Nieuwe memory `mem://features/zone-fill-strategy` met: prio-veld, drempel-gedrag, terras-voorkeur als soft hint, weer-condities via Open-Meteo, kanaal-scope (widget + AI voice + walk-in suggesties).
