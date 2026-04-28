# Rapportages uitbreiden — uur-bezetting, top tafels, reminders, AI-performance

## Uitgangspositie
De rapportagepagina `/app/rapportages` heeft al een sterke basis met centrale `src/services/reporting.ts`:
- ✅ Reserveringen-totalen, statusverdeling, per dag, gem. groepsgrootte
- ✅ Kanalen (incl. AI Host, ClickWise, walk-in, etc.) met no-show% per kanaal
- ✅ No-show: aantal, %, herbevestigingen open/bevestigd, grote-groep no-shows
- ✅ Wachtlijst-conversie, walk-ins, grote groepen
- ✅ Pre-orders met geschatte omzet en topitems
- ✅ Reviews, gasten/CRM, POS-omzet (rolbewust), pacing per half uur
- ✅ Insight-cards en datumfilter (vandaag/gisteren/week/maand/custom)

## Wat ontbreekt nog (uit de opdracht)
1. **Bezetting per uur** — hourly breakdown (reservations + covers per uur, niet per half uur)
2. **Populairste tijdslots** als top-lijst (nu alleen als grafiek via pacing)
3. **Top tafels & top zones** — bestaat nog niet
4. **Reminders verzonden** + per type + op-tijd-annuleringen
5. **AI Voice Agent performance** — `agent_call_logs` wordt nog niet gerapporteerd
6. **Pre-order conversieratio** (pre-orders / reserveringen × 100)

## Aanpak
Uitbreiden van bestaande infra — geen nieuwe pagina, geen nieuwe service.

### 1. `src/services/reporting.ts` — 4 nieuwe functies toevoegen
| Functie | Bron | Output |
|---|---|---|
| `getHourlyOccupancy(restaurantId, range)` | `reservations` | Array `{hour: "HH:00", reservations, covers}`, telt cancelled/hold uit |
| `getTopSeatingMetrics(restaurantId, range)` | `reservations` + `reservation_tables` + `tables` + `zones` | `{tables: top 8, zones: alle}` met reservations + covers per tafel/zone |
| `getReminderMetrics(restaurantId, range, cutoffMin)` | `reservation_reminders` + `reservations` | `{totalSent, byType, failed, pending, reconfirmationsSent, cancelledOnTime}` (op-tijd = `cancelled_at` ≥ `start_time − cutoffMin`) |
| `getAIPerformanceMetrics(restaurantId, range)` | `agent_call_logs` + `integration_logs` (source=voice_agent, status=failed) | `{totalCalls, successfulBookings, failedBookings, handovers, avgDurationSeconds, byOutcome, topErrorCodes, successRate}` |

Optimalisatie: alle queries gefilterd op `restaurant_id` + datumvenster zodat RLS-indexen werken; geen N+1 (1 batch-call voor `reservation_tables` met `.in()`).

### 2. `src/pages/app/ReportsPage.tsx` — drie nieuwe secties + uitbreiding KPI's

Toevoegen in deze volgorde, na bestaande "Reserveringen & covers":

**A. Bezetting per uur & populaire tijdslots** (na "Reserveringen & covers")
- Bar chart: covers per uur via `getHourlyOccupancy`
- Top 5-lijst: drukste tijdslots (uit pacing)
- Empty state als geen data

**B. Top tafels & zones** (nieuwe sectie)
- 2-koloms: top 8 tafels (label + zone) en lijst zones (alle)
- Sorteerd op aantal reserveringen
- Empty state

**C. Reminders & op-tijd annuleringen** (uitbreiding van No-show sectie of nieuwe directe sectie)
- KPI's: Reminders verzonden, Bevestigingen verzonden, Reminders 24u/2u, Mislukte verzendingen, Annuleringen op tijd
- Splitsing per `reminder_type`

**D. AI Voice Agent performance** (na Kanalen)
- KPI's: Aantal calls, Geslaagde boekingen, Mislukte boekingen, Overdrachten, Slaagpercentage, Gem. gespreksduur (mm:ss)
- Lijst top 5 foutcodes met aantal
- Empty state met link naar `/app/voice-agent` als nog geen calls

**E. Pre-orders sectie** — extra KPI "Conversieratio"
- `pre_orders.total / reservations.total × 100`

### 3. `App.tsx` / routing
Geen wijziging — pagina blijft op `/app/rapportages`.

## Bestanden
**Aangepast**
- `src/services/reporting.ts` — 4 functies + 4 type-exports toegevoegd, geen wijziging in bestaande functies
- `src/pages/app/ReportsPage.tsx` — Promise.all uitbreiden, 3 nieuwe ReportSection-blocks, 1 KPI extra in pre-orders

**Niet aangeraakt**
- Bestaande functies in `reporting.ts`
- `ReportPrimitives.tsx`, `ReportDateRangePicker.tsx`
- DB schema, RLS, edge functions
- Andere pagina's

## Guardrails toegepast
- **Bestaande data** — alle nieuwe metrics komen uit bestaande tabellen (`reservations`, `reservation_tables`, `tables`, `zones`, `reservation_reminders`, `agent_call_logs`, `integration_logs`)
- **Lege states** — elke nieuwe sectie heeft `EmptyState` als data ontbreekt
- **Performance** — datumvensters op alle queries, geen N+1, batch via `.in()`, gebruik bestaande indexen (`idx_agent_call_logs_restaurant_created`, `idx_reminders_restaurant_scheduled`)
- **Tablet-first** — KPI-grids gebruiken bestaande `ReportKpiCard` en blijven responsive