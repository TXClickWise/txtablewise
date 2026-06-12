## Doel
Windkracht én windrichting tonen in de weer-UI, en de regel-engine gevoeliger maken voor wind (vooral relevant voor terras).

## Datalaag
- `weather_forecasts`: kolom `wind_direction_deg smallint` toevoegen (dag = dominante richting). `wind_kmh_max` bestaat al.
- `weather_hourly`: kolom `wind_direction_deg smallint` toevoegen. `wind_kmh` bestaat al.
- Geen nieuwe tabellen, geen RLS-wijzigingen.

## Edge functions
- **`weather_fetcher`**: Open-Meteo call uitbreiden met `wind_direction_10m` (hourly) en `wind_direction_10m_dominant` (daily). Upsert mappen naar nieuwe kolommen.
- **`weather_advise`**:
  - Drempel `storm_warning` verlagen naar **≥50 km/u** (was 60) en headline windrichting meenemen ("Harde ZW-wind vanaf 14:00, terras lastig").
  - Nieuwe regel `terrace_breeze_warning` bij **35–49 km/u** tijdens een shift mét actieve terras-zone → milde tip ("Stevige wind verwacht — windschermen klaarzetten?"). `severity = info`.
  - Bestaande types onveranderd.

## Frontend
- `src/services/weather.ts`:
  - Types uitbreiden met `wind_direction_deg`.
  - Helper `degToCompass(deg)` → `N/NO/O/ZO/Z/ZW/W/NW` (NL-afkortingen).
  - Helper `windLabel(kmh)` → Beaufort-achtige korte labels ("Zwak", "Matig", "Krachtig", "Hard", "Storm").
- `WeatherPill.tsx`: in de samenvatting naast temp ook compacte wind-chip tonen wanneer ≥20 km/u (bv. "💨 32 km/u ZW"). Anders verborgen om rust te bewaren.
- `WeatherSheet` (binnen pill): per uur-rij een klein pijltje (rotatie = richting) + km/u; in de 7-daagse strip max-wind + richting onder min/max temp.
- `AdvisoryStrip.tsx`: ongewijzigd (krijgt automatisch de nieuwe wind-advisories binnen).

## Wat we expliciet niet doen
- Geen aparte wind-pagina of grafiek.
- Geen gust/windvlaag-data (Open-Meteo levert het wel, maar voegt voor operator weinig toe — `wind_speed_10m_max` volstaat).
- Geen automatische zone-acties op basis van wind; blijft bewuste keuze in zone-config (`weather_dependent`).

## Uitvoervolgorde
1. Migratie: 2 kolommen toevoegen.
2. `weather_fetcher` + `weather_advise` updaten.
3. `src/services/weather.ts` helpers + types.
4. `WeatherPill` + sheet visuele update.
5. Memory `mem://features/weather-insights` bijwerken (wind toegevoegd, drempels).
