## Doel

Operator ziet zonder gedoe het weer voor vandaag, de komende uren en de week vooruit op de schermen waar het ertoe doet — én krijgt **alleen een AI-tip wanneer het weer iets verandert aan hun dienst** (regen tijdens diner, hittegolf, mooie vrijdag met lege wachtlijst, terras-zone die nu wel/niet open zou moeten). Geen meteorologen-jargon, geen dashboards vol grafieken.

## Wat de operator straks ziet

1. **Weer-pill op `/app/today` en `/app/vloer`** (klein, rechtsboven): icoon + temp nu + neerslag-kans komende 3 uur. Tap = sheet met 24u-grafiek en 7-daagse strip.
2. **Stille AI-tip-strip** boven de agenda van vandaag — alleen zichtbaar als de regel-engine + AI iets concreets te zeggen heeft. Voorbeelden:
   - "Regen vanaf 19:20 — terras-reserveringen (5) krijgen automatisch een binnen-alternatief voorgesteld? [Bekijken]"
   - "26°C en zonnig zaterdag — wachtlijst voor terras nog leeg. [Wachtlijst openen]"
   - "Vorst vannacht — terraszone 'Tuin' wordt morgen niet automatisch geactiveerd."
3. **Weer-kolom in 7-daagse agenda** (`/app/agenda`): klein icoon per dag, hover/tap voor detail.
4. **Pilot Launch / Algemene instellingen**: read-only "Locatie voor weer: 52.37, 4.89 (uit adres) — [Overschrijven]".

Alles is opt-in op organisatieniveau via één toggle in instellingen: **"Weer-inzichten gebruiken"** (default aan bij nieuwe accounts; bestaande zien een eenmalige banner).

## Datalaag

**Bestaand**: `weather_forecasts` (dag-niveau: min/max temp, neerslag) + `restaurants.latitude/longitude`.

**Toevoegen**:

- Kolommen op `weather_forecasts`: `condition_code` (WMO-code 0–99 → vertaalt naar icoon/label), `wind_kmh_max`, `uv_index_max`, `sunrise`, `sunset`.
- Nieuwe tabel `weather_hourly` — slank, alleen vandaag + morgen:
  - `restaurant_id`, `hour_ts timestamptz`, `temp_c`, `precipitation_mm`, `precipitation_prob_pct`, `condition_code`, `wind_kmh`, `fetched_at`. Unique `(restaurant_id, hour_ts)`. RLS net als `weather_forecasts`.
- Kolommen op `restaurants`:
  - `weather_enabled boolean default true`
  - `weather_location_override boolean default false` — als true: lat/lon worden niet meer overschreven door geocoding
  - `weather_location_label text` — bv. "Amsterdam (uit adres)" of handmatige plaatsnaam
- Nieuwe tabel `weather_advisories` — gegenereerde tips, max 1 actieve per type per dag:
  - `restaurant_id`, `date`, `type` (`rain_during_service`, `heatwave`, `frost_terrace`, `great_weather_low_bookings`, `storm_warning`), `severity` (`info|warn`), `headline_nl text`, `body_nl text`, `action_route text` (deeplink), `dismissed_at`, `created_at`. RLS: members read/update (dismiss), service_role write.

## Backend — drie edge functions

1. **`weather_geocode`** (verify_jwt=true, owner/manager):
   - Input: restaurant_id. Leest adres-velden, roept Open-Meteo geocoding (`https://geocoding-api.open-meteo.com/v1/search`, geen key) en slaat lat/lon + label op. Skipt als `weather_location_override = true`. Wordt aangeroepen vanuit settings-page bij adres-wijziging en vanuit `weather_fetcher` voor restaurants zonder lat/lon.
2. **`weather_fetcher`** (verify_jwt=false, service-role; cron-aangedreven):
   - Voor elk restaurant met `weather_enabled = true` en lat/lon: één Open-Meteo forecast-call (`hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m`, `daily=temperature_2m_min,temperature_2m_max,precipitation_sum,weather_code,wind_speed_10m_max,uv_index_max,sunrise,sunset`, 7 dagen).
   - Upsert in `weather_forecasts` (daily) en `weather_hourly` (vandaag + morgen, oudere uren prunen).
   - Daarna `weather_advise()` (interne functie of aparte call) per restaurant.
3. **`weather_advise`** (verify_jwt=false, service-role):
   - Pure regel-engine bepaalt of er een advies-trigger is. Voorbeelden:
     - Regen >0.5mm/u + neerslagkans >60% tijdens een shift, terwijl er reserveringen op een terras-zone staan → `rain_during_service`.
     - Max temp ≥28°C een willekeurige dag in komende 5 → `heatwave`.
     - Min temp ≤2°C voor morgen + restaurant heeft een `is_terrace` zone met `weather_dependent=true` → `frost_terrace`.
     - Weerwaarde (temp 20–28, kans neerslag <20%, weekend) + wachtlijst leeg + bezetting <50% voor die dag → `great_weather_low_bookings`.
     - Wind ≥60 km/u → `storm_warning` (terraszones met `weather_dependent` automatisch geblokt — leeft al in `book_reservation`).
   - **Alleen als** een regel triggert, vraagt de functie de Lovable AI Gateway (`google/gemini-2.5-flash`) om de tip te herschrijven naar één korte, hospitality-vriendelijke zin in NL, met optionele tweede regel. Strikte system prompt: max 2 zinnen, geen jargon, geen overdrijving, geen emoji-spam. Resultaat in `weather_advisories`. Geen trigger = geen AI-call = geen kosten.
   - Idempotent per `(restaurant_id, date, type)`.

**Scheduling** (via `supabase--insert`, pg_cron):
- `weather_fetcher` elke 3 uur. Dat is ruim binnen Open-Meteo free-tier (10k calls/dag, wij doen ≤8 × #restaurants).
- Bij eerste pilot-restaurant + bij `weather_enabled` aanzetten: trigger direct een run via een lichte RPC `kick_weather_fetcher(restaurant_id)` zodat operator niet hoeft te wachten.

## Frontend

- `src/services/weather.ts` — fetches `weather_forecasts`, `weather_hourly`, `weather_advisories` met react-query keys per restaurant. Helpers: `weatherCodeToIcon()`, `weatherCodeToLabelNl()`, `nextRainAt(hours)`.
- `src/components/weather/WeatherPill.tsx` — kleine pill voor `TodayPage` en `FloorModePage` (gebruikt touch-primitives voor tap-target, opent een `Sheet` met 24u + 7d).
- `src/components/weather/WeatherSheet.tsx` — 24u-staafje (alleen icoon + uur + neerslag-balk), 7-daagse strip (min/max + icoon). Geen grafieklib nodig; div-staafjes.
- `src/components/weather/AdvisoryStrip.tsx` — toont **maximaal 1** actieve advisory boven agenda met dismiss-knop (zet `dismissed_at`) en optionele deeplink-knop (`action_route` → bv. `/app/wachtlijst?date=...`).
- `src/components/weather/WeatherDayBadge.tsx` — klein icoon/temp in `AgendaPage` 7-daagse view.
- `src/pages/app/settings/GeneralSettings.tsx`: nieuw blok "Weer-inzichten": toggle `weather_enabled`, read-only locatie, knop **Overschrijven** opent dialog (stad/postcode → geocode preview → opslaan, zet `weather_location_override = true`). Knop **Terug naar automatisch** zet override uit en triggert herberekening uit adres.
- I18n: alle UI-strings in `nl/common.json` (en stub voor en/de/fr — pas alleen NL volledig, conform projecttoon).

## Edge cases & guardrails

- Geen lat/lon én geen adres → toon in settings "Locatie nodig om weer te tonen", verberg pills.
- Open-Meteo down/timeout → laatst-bekende cache blijft staan, pill toont leeftijd ("Bijgewerkt 4u geleden") als >6u oud.
- Advisory-dedup: zelfde type op zelfde dag wordt niet hergegenereerd; bij wezenlijke wijziging (bv. regen schuift >2u) mag nieuwe versie van zelfde type oude vervangen.
- AI-call faalt → val terug op de regel-template-tekst (we bewaren een NL-default per regel).
- Privacy: lat/lon is restaurant-niveau, geen gastdata; geen extra disclosures nodig.
- Plan-gating: weer-pill + 7-daagse beschikbaar op alle plannen; **AI-advisories alleen op Basic+** (Trial krijgt regel-template-versie). Via `<FeatureGate feature="weather_ai_tips">`.

## Wat we **niet** doen (bewust)

- Geen eigen geocoder of kaart-UI; alleen Open-Meteo's gratis endpoint.
- Geen push/SMS van advisories naar operator (zou op te dringerig zijn — ze leven alleen in-app).
- Geen automatische acties op reserveringen (terras-zone uitschakelen bij regen blijft een bewuste keuze van de zone-config, niet "AI heeft je terras dichtgegooid").
- Geen meerdaagse weersgrafieken — pure operator-relevantie.

## Memory-update

Nieuwe memory `mem://features/weather-insights` met:
- Open-Meteo als bron (geen key, gratis), 3u cadans.
- AI-tips zijn "stil tenzij relevant" en altijd door regel-engine getriggerd (nooit pure LLM-uitstoot).
- Advisory-types limitatief: `rain_during_service | heatwave | frost_terrace | great_weather_low_bookings | storm_warning`.
- Pill en sheet wonen onder `src/components/weather/`; service in `src/services/weather.ts`.

## Technische volgorde van uitvoering

1. Migratie: kolommen + `weather_hourly` + `weather_advisories` + grants/RLS.
2. Edge functions `weather_geocode`, `weather_fetcher`, `weather_advise` + pg_cron schedule via insert-tool.
3. `src/services/weather.ts` + weather UI-componenten.
4. Inhaken in `TodayPage`, `FloorModePage`, `AgendaPage`, `GeneralSettings`.
5. FeatureGate-koppeling + i18n.
6. Memory update.
