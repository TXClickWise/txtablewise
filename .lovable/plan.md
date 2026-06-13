## Doel
Inactieve tafels tonen op Agenda > Plattegrond én Floor Mode met dezelfde visuele "UIT"-stijl als in Instellingen-plattegrond (gearceerd, gedimd, niet aantikbaar). Zelfde behandeling in Tijdlijn/Lijst-views van Agenda voor consistentie.

## Wijzigingen

### 1. `src/pages/app/AgendaPage.tsx`
- **Query**: verwijder `.eq("is_active", true)` uit de `agenda-tables` query en voeg `is_active` toe aan select.
- **Tijdlijn & Lijst views**: rij van inactieve tafel krijgt `opacity-60` + badge "UIT" naast het label. Klikken op tijdlijn-cellen voor nieuwe reservering blokkeren (al bestaande reserveringen wél openen — voor het zeldzame geval dat een reservering nog hangt op een net uitgezette tafel).
- **`FloorPlanBody`**: per tafel-button — bij `!t.is_active`:
  - Override tone-styling: gearceerd patroon (`repeating-linear-gradient(45deg, hsl(var(--muted-foreground) / 0.15) 0 6px, transparent 6px 12px)`) + `opacity-60` + `cursor-not-allowed`.
  - Toon "UIT" badge ipv status-dot/tijden.
  - `onClick` no-op (geen nieuwe reservering, geen openen).
  - `aria-label`: "Tafel X — niet beschikbaar".

### 2. `src/pages/app/FloorModePage.tsx`
- Query: verwijder `.eq("is_active", true)` op tafels (regel 165) en voeg `is_active` toe aan select.
- Render: inactieve tafels krijgen dezelfde "UIT"-stijl (gearceerd, gedimd, niet aantikbaar). Sluit ze uit van walk-in suggesties (recommend-logic werkt al via `is_active` filter aan de bron — bij implementatie verifiëren dat de in-page recommend-call ze niet meeneemt).

### 3. Microcopy
- Badge tekst: "UIT" (kleine caps, muted achtergrond).
- Tooltip op de tafel: "Tafel staat op niet-beschikbaar. Zet aan via Instellingen > Zones & Tafels of de Plattegrond-editor."

## Niet in scope
- Inline aan/uit-toggle vanuit Agenda/Floor Mode (kan later — vereist permissie- en bevestigingslaag).
- Wijzigingen aan auto-reserveringsflows (filteren al correct op `is_active`).
- Schema-wijzigingen.

## Verificatie
1. Tafel 104 uitzetten in Instellingen → verschijnt nu gearceerd met "UIT" in Agenda > Plattegrond > Terras.
2. Klikken op 104 doet niets (geen reservering-dialog).
3. Tijdlijn-view toont tafel 104 met "UIT" badge en kan niet aangetikt worden voor nieuwe reservering.
4. Floor Mode toont 104 ook gearceerd; walk-in stelt 104 niet voor.
5. Tafel 104 weer aanzetten → terug naar normaal.
