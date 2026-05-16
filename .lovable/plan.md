## Probleem 1 — "Geen tafel toegewezen" in Agenda → Lijst

**Oorzaak**
In `src/pages/app/AgendaPage.tsx` selecteert de `agenda-day`-query alleen `reservation_tables(table_id)` — zonder de gekoppelde `tables(label)`. Bovendien wordt in `listReservations` (de mapping naar de `DayView`/`ReservationCard`) het veld `reservation_tables` helemaal weggelaten. `ReservationCard` leest `r.reservation_tables[].tables?.label` om het tafelnummer te tonen, dus die valt altijd leeg → "Geen tafel toegewezen". De Tijdlijn- en Plattegrond-views werken wél omdat die intern via `byTable[table.id]` koppelen, niet via het label.

In `TodayPage`, `ReservationsPage` en `LargeGroupsPage` is `tables(label)` wél meegenomen, dáár klopt de weergave.

**Fix**
1. In `AgendaPage.tsx` de query uitbreiden: `reservation_tables(table_id, tables(label))`.
2. In de `listReservations` `useMemo` het veld `reservation_tables: r.reservation_tables ?? []` doorgeven, zodat `ReservationCard` het tafel-label kan tonen.

Geen wijzigingen in andere pagina's nodig — die tonen het tafel-label al correct.

## Probleem 2 — Plattegrond "Restaurant"-zone trilt heftig

**Oorzaak**
In `FloorPlanBody` (onderaan `AgendaPage.tsx`) zit een ResizeObserver-feedbackloop:
- `containerRef` heeft `overflow-auto`.
- `scale = (containerW - padding*2) / bbox.w` → `scaledH` bepaalt `minHeight` van de inner div.
- De Restaurant-zone bevat veel/grotere tafels, dus `scaledH` net groter dan de viewport → verticale scrollbar verschijnt → `containerW` krimpt ~15 px → `scale` daalt → `scaledH` daalt → scrollbar verdwijnt → `containerW` groeit → loop. Dit veroorzaakt het zichtbare "trillen".

**Fix**
Twee kleine wijzigingen in `FloorPlanBody`:
1. De scroll-container krijgt `overflow-y-scroll` (in plaats van `overflow-auto`), zodat de verticale scrollbarbreedte constant is en niet meer toggelt.
2. `setContainerW` alleen aanroepen wanneer de breedte écht verandert (delta > 1 px), als extra demping tegen sub-pixel oscillaties van de ResizeObserver.

## Scope

Alleen frontend/presentatie. Geen wijzigingen aan datamodel, edge functions, of aan andere views/pagina's.

## Bestanden

- `src/pages/app/AgendaPage.tsx` — query uitbreiden, mapping aanvullen, `FloorPlanBody` scroll-/observer-stabilisatie.
