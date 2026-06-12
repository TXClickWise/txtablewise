---
name: Zone fill-strategie
description: Vul-volgorde per zone met drempel, condities en terras-voorkeur voor online/AI/walk-in boekingen
type: feature
---
# Zone fill-strategie

**Doel**: bij online, AI-voice en walk-in suggesties wordt het restaurant in instelbare zone-volgorde gevuld, met drempel-gebaseerde overloop en condities per zone. Gast kiest géén zone in widget/voice — wel optioneel "graag op het terras".

## Activering
- Feature-flag `restaurants.fill_strategy_enabled` (default false). Owner zet aan via Instellingen → Zones → "Vul-strategie" card.
- Actief voor `channel in ('online', 'ai_host', 'phone')`. Walk-in / manager houden vrije tafelkeuze.

## Sleutelvelden
- `zones.fill_priority` — drag-volgorde in Instellingen schrijft beide `sort_order` én `fill_priority` (laagste = eerst vullen).
- `zones.fill_threshold_pct` (default 70) — zone "vol genoeg" → volgende zone vrijgegeven.
- `zones.{min,max}_party_size`, `active_weekdays`, `active_time_from/to` — wanneer de zone in aanmerking komt.
- `zones.weather_dependent` + `weather_min_temp_c` + `weather_blocks_on_precipitation` — terras-condities.
- `zones.is_terrace` — markeert welke zones de terras-voorkeur kunnen vervullen.
- `tables.fill_priority` — sub-volgorde binnen een zone.
- `reservations.prefers_terrace` + `terrace_preference_unmet` — gast-voorkeur en of die gehonoreerd kon worden.
- `weather_forecasts` — dagelijkse cache (Open-Meteo); ontbreekt = "weer onbekend" = niet blokkeren.

## Algoritme (`supabase/functions/_shared/zone-fill.ts`)
1. `resolveActiveZones` filtert op weekdag, tijd, party-size, weer.
2. `pickTableWithFillStrategy`:
   - Eerst terras als `prefers_terrace=true` én terras-zone actief; anders terrace_preference_unmet=true.
   - Anders: bepaal "primary zone" = eerste actieve zone in `fill_priority`-volgorde die nog onder `fill_threshold_pct` zit.
   - Best-fit binnen primary; tafels uit volgende zones krijgen oplopende rank.
   - Tie-break: `capacity_max - party_size`, dan `tables.fill_priority`, dan label.
3. Fallback combinatie-tafels (`findAvailableCombination`) zoals voorheen als geen enkele tafel past.

## Aanroepende plekken
- `supabase/functions/book_reservation/index.ts` — orchestreert occupancy-per-zone + helper.
- `supabase/functions/agent_api/index.ts` — voice-payload spreidt naar book_reservation; `prefers_terrace` boolean meegegeven door agent.
- `src/pages/ReserveWidget.tsx` — wanneer `zone === "terrace"` in bestaande chip → `prefers_terrace=true`.
- `docs/agent-api-contract.md` — `prefers_terrace` veld gedocumenteerd.

## Nog te doen (toekomstig)
- `weather_refresh` edge function + cron voor Open-Meteo fetch (lat/long op restaurants).
- Reporting blok: zone-bezetting + % terras-voorkeur gehonoreerd.
- Walk-in `tableRecommendation.ts` ook door helper laten lopen.
