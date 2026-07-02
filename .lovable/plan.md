## Waarom je walk-in óók op t50 kwam

Bij een walk-in met vooraf gekozen tafel gebeurt dit nu:

1. `WalkInQuickSheet` stuurt `tableId = t13` naar `createWalkIn` (`src/services/walkIn.ts`).
2. `createWalkIn` roept edge function `book_reservation` aan, maar geeft de gekozen tafel alléén mee in `source_metadata.preselected_table_id`. **`book_reservation` leest dat veld nergens** en kiest zelf een tafel via de aanbevelings-logica → bijv. t50. Er wordt een rij `reservation_tables (reservation, t50)` aangemaakt.
3. Terug in `createWalkIn` zie je dan dat `reservation.table_id (t50) ≠ v.tableId (t13)`, en wordt er **een tweede rij `reservation_tables (reservation, t13)` bijgezet**. Resultaat: één reservering gekoppeld aan zowel t13 als t50.

## Oplossing

Twee kleine, gerichte wijzigingen, geen wijziging in businesslogica of UI:

### 1. `supabase/functions/book_reservation/index.ts`
- Accepteer een expliciete `preselected_table_id` bovenaan de body (naast bestaande velden).
- Als aanwezig én de operator-flow (`channel` = `walk_in` of `manager`):
  - Valideer dat de tafel bij het restaurant hoort, actief is, capaciteit voldoet en niet bezet is in het gekozen tijdvenster (hergebruik bestaande occupancy/overlap-check).
  - Zo ja: gebruik deze als `chosenTableIds = [preselected_table_id]` en sla de aanbevelings-selectie over.
  - Zo nee: retourneer een duidelijke `error_code: "preselected_table_unavailable"` in plaats van stilletjes een andere tafel te kiezen.
- Combinatie-logica en pacing blijven ongewijzigd.

### 2. `src/services/walkIn.ts`
- Stuur `preselected_table_id: v.tableId` als top-level veld mee in de body (blijf het ook in `source_metadata` zetten voor audit).
- **Verwijder** het `reservation_tables.insert` na de call. De engine koppelt nu altijd de juiste tafel — nooit meer twee.
- Foutmelding `preselected_table_unavailable` netjes vertalen naar `reason_code: "no_table"` met copy "Deze tafel is net bezet — kies een andere.".

### 3. Data-fix
- Losse SQL (via `supabase--insert`) om bestaande dubbele koppelingen op te ruimen: voor elke reservering met >1 `reservation_tables` de gekoppelde tafel behouden die overeenkomt met `source_metadata.preselected_table_id`, de rest verwijderen. Alleen uitvoeren na akkoord.

## Waarom deze aanpak
- Fixt de root cause (twee inserts) i.p.v. symptoombestrijding in de UI.
- `FloorMode`, `FloorPlan` en `AI Quick Seat` gebruiken allemaal dezelfde `createWalkIn` → één fix dekt alles.
- Geen risico voor publieke widget of AI-host: die sturen geen `preselected_table_id`.
