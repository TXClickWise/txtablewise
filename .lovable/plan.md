# Tijdlijn zoom: één knop voor beide richtingen

## Doel
- De afzonderlijke verticale "rijhoogte"-knop (MoveVertical) in de tijdlijn-toolbar verwijderen.
- De bestaande − / 100% / + zoomknoppen laten zowel de horizontale schaal (`pxPerMin`) als de verticale rijhoogte (`rowHeight`) evenredig mee schalen.

## Scope
Alleen `src/pages/app/AgendaPage.tsx` (de Tijdlijn-weergave op /app/agenda). Andere views (Lijst, Plattegrond, TableGridView, FloorMode) blijven ongewijzigd.

## Wijzigingen

1. **Afgeleide rijhoogte** — `rowHeight` koppelen aan `pxPerMin`:
   - `derivedRowHeight = clamp(ROW_DEFAULT * (pxPerMin / PX_DEFAULT), ROW_MIN, ROW_MAX)`
   - State `rowHeight` en `setRowHeight` verwijderen (of vervangen door `useMemo` op `pxPerMin`).
2. **Toolbar opschonen**:
   - De `<Button>` met `MoveVertical` (regel 421-423) verwijderen.
   - Bijbehorende `rowZoom` helper (regel 273-274) verwijderen.
   - Import `MoveVertical` uit lucide-react verwijderen.
3. **Pinch-zoom** blijft ongewijzigd (gebruikt al alleen `pxPerMin`); de rijhoogte volgt automatisch via de afgeleide waarde.
4. **Ondergrens**: omdat `PX_MIN=1` en `PX_DEFAULT=2`, valt de afgeleide rijhoogte bij maximaal uitzoomen op `ROW_DEFAULT * 0.5 = 32` — daarom de `ROW_MIN` (48) handhaven via clamp, zodat tekst in tafelblokken leesbaar blijft. Bij maximaal inzoomen (`PX_MAX=6`) wordt `rowHeight` geclampt op `ROW_MAX` (120).

## Acceptatiecriteria
- De omcirkelde verticale knop staat niet meer in de toolbar.
- − en + knoppen zoomen zichtbaar zowel kolombreedte als rijhoogte evenredig in/uit.
- 100%-label blijft de horizontale zoom weergeven (ongewijzigd gedrag).
- Pinch-zoom op tablet werkt nog en past ook de rijhoogte aan.
- Geen wijzigingen aan data, reserveringslogica of andere views.
