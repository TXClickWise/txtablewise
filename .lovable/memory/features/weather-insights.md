---
name: Weer-inzichten
description: Open-Meteo bron, dag+uur forecast, stille AI-tips alleen bij regelmatch, auto-geocoding met override
type: feature
---

## Bron & cadans
- Open-Meteo (gratis, geen API key). 3-uurlijkse cron via `weather_fetcher` edge function.
- Tabellen: `weather_forecasts` (daily, 7d), `weather_hourly` (vandaag+morgen, max 48u), `weather_advisories` (gegenereerde tips).
- Restaurants kolommen: `weather_enabled` (default true), `weather_location_override`, `weather_location_label`, gebruikt bestaande `latitude/longitude`.

## Edge functions
- `weather_geocode` — owner/manager only, gebruikt Open-Meteo geocoding API om lat/lon uit adres af te leiden of handmatige stad/postcode in te stellen (zet `weather_location_override = true`).
- `weather_fetcher` — service-role, cron-aangedreven (`tablewise-weather-fetcher`, elke 3u op minuut 7). Per restaurant: 1 forecast call, upsert daily+hourly, prune oude uren, daarna `weather_advise` trigger.
- `weather_advise` — service-role. Pure regel-engine bepaalt of een advisory triggert. Alleen DAN AI-call (Lovable Gateway `google/gemini-2.5-flash`) om naar gastvrije NL-zin te herschrijven. Idempotent op `(restaurant_id, date, type)`.

## Advisory-types (limitatief)
- `rain_during_service` — regen >0.5mm + >60% prob in komende 6u, alleen als restaurant minstens 1 terras-zone heeft. Warn.
- `heatwave` — max_temp ≥28°C in komende 5d. Info.
- `frost_terrace` — min_temp ≤2°C morgen + heeft `is_terrace=true, weather_dependent=true` zone. Info.
- `storm_warning` — wind ≥60km/u vandaag of morgen. Warn.
- `great_weather_low_bookings` — weekenddag met 20-30°C en <1mm regen, <5 bevestigde reserveringen. Info.

## Toon
- "Stil tenzij relevant": geen pill-advies tenzij regel matcht. Geen push/SMS naar operator — leven alleen in-app.
- Geen automatische acties op reserveringen — terras-zone uit/aan blijft door zone-config bepaald, niet door "AI heeft je terras dichtgegooid".

## Frontend
- `src/services/weather.ts` — react-query fetchers + `interpretCode()`, `currentHour()`, `nextRainAt()`.
- `src/components/weather/WeatherPill.tsx` — knop met temp + icoon + eerstvolgende regen, opent Sheet met 24u-strip + 7-daagse strip. Hangt in `TodayPage` en `FloorModePage` header.
- `src/components/weather/AdvisoryStrip.tsx` — max 1 actieve advisory boven agenda, met deeplink-knop en dismiss (zet `dismissed_at`).
- `src/components/weather/WeatherSettingsCard.tsx` — toggle + locatie-status + Overschrijven-dialog + "Terug naar automatisch". Ingebouwd in `GeneralSettings`.

## Plan-gating
- Niet expliciet plan-gated in MVP — weer-pill + advisories beschikbaar zodra `weather_enabled=true` en lat/lon bekend. Indien later gewenst: voeg `weather_ai_tips` feature toe en zet advise-flow alleen aan vanaf Basic+.
