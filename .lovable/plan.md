
## Probleem

Bij Eigeweis staat de vul-strategie aan met zone-volgorde Terras → Serre → Restaurant → Podium. Bij een nieuwe boeking via de widget werkt dat goed (`book_reservation` past de strategie toe). Maar als een gast via de mail z'n reservering verplaatst, wordt er een tafel gekozen die volledig voorbij de strategie gaat — in dit geval tafel 50 in Podium, terwijl Serre/Terras vrij waren.

Oorzaak: de helper `findAvailableSeating` die we voor de gast-flow hebben gemaakt sorteert puur op `capacity_max ASC`. Geen zones, geen `fill_priority`, geen terras-voorkeur, geen terras-blokkering bij regen. Dezelfde helper wordt ook gebruikt in `review_guest_change` (operator keurt gastwijziging goed) en in `public_api` (extern manage-reservation pad), dus die hebben hetzelfde probleem.

## Fix

Eén gedeelde "seating picker" die de volledige vul-strategie toepast, en die zowel `book_reservation` als alle wijzig-flows gebruiken. Geen nieuwe logica — we hergebruiken `resolveActiveZones` + `pickTableWithFillStrategy` + `pickCombinationWithFillStrategy` uit `zone-fill.ts`, plus de bestaande overlap-detectie.

### Stappen

1. **Nieuwe shared helper** `pickSeatingWithStrategy` in `supabase/functions/_shared/reservation-utils.ts`:
   - Input: `sb`, `restaurantId`, `partySize`, `startIso`, `endIso`, `timezone`, `excludeReservationId?`, `excludedTableIds?`, `prefersTerrace?`, `date` (YYYY-MM-DD, voor weer-lookup), `fallbackToLegacy` (bool — voor wanneer fill_strategy_enabled = false).
   - Haalt zelf zones, alle actieve tafels, fitting tafels, overlapping reserveringen, weer-row op.
   - Bouwt `occupancyByZone`, roept `resolveActiveZones` + `pickTableWithFillStrategy` aan.
   - Bij geen losse tafel: combinaties via `pickCombinationWithFillStrategy`.
   - Return `{ combinationId, tableIds, name, terracePreferenceUnmet, zoneId } | null`.
   - Als `fallbackToLegacy = true` en `fill_strategy_enabled = false`: val terug op huidige `findAvailableSeating`-gedrag (eerste passende losse tafel, dan combinatie). Helper leest `fill_strategy_enabled` zelf uit `restaurants`.

2. **Aanpassen call-sites** — `findAvailableSeating` vervangen door `pickSeatingWithStrategy` in:
   - `supabase/functions/guest_reservation/index.ts` — `evaluate()` (regel 502) en de `applied`-branch (regel 264). `prefersTerrace` lezen uit `reservation.prefers_terrace` als die kolom bestaat, anders `false`.
   - `supabase/functions/review_guest_change/index.ts` — `applied`-branch (regel 84).
   - `supabase/functions/public_api/index.ts` — manage-reservation paden (regels 776 / 792 / 806).

3. **`book_reservation` opschonen** — de inline fill-strategy block (regels 171–252) vervangen door één call naar `pickSeatingWithStrategy`. Operator-specifieke gedragingen (kanaal-check `channel === "online" | "ai_host" | "phone"` voor `fillStrategyOn`, en walk-in/manager skip) blijven in `book_reservation` zelf — we geven `useFillStrategy: boolean` mee aan de helper in plaats van dat de helper het kanaal kent. Doel: één bron van waarheid voor "welke tafel kies ik" zonder dat `book_reservation` z'n operator-policies kwijtraakt.

4. **`findAvailableSeating` behouden** als deprecated re-export (interne gebruikers overgezet, externe code zou er niet bij moeten). Verwijderen kan later.

### Verificatie

1. In Eigeweis: huidige reservering RSYBNY5B handmatig verplaatsen via de gastlink naar een nieuw tijdstip → moet nu in **Terras** of **Serre** landen, niet Podium. Bevestigen via `reservation_tables` + zone-naam.
2. Tweede testreservering: terras-zone weer-blokkeren (bv. tijdelijk min_temp hoog zetten of regen in weather_forecasts) → moet in Serre landen.
3. Smoke: nieuwe boeking via widget bij Eigeweis (party 2) → moet nog steeds in Terras/Serre komen, niet Podium (regressie-check op `book_reservation`).
4. Smoke: restaurant met `fill_strategy_enabled = false` → wijziging via gastlink valt terug op "eerste vrije passende tafel" (huidig gedrag).

## Niet in scope

- UI/copy van de bevestigings- of afwijspagina.
- Nieuwe instellingen of toggles voor gast-wijzigingen — we gebruiken de bestaande `fill_strategy_enabled` van het restaurant.
- Pacing-check voor gastwijzigingen (blijft zoals nu).

## Risico

`public_api` manage-paden krijgen nu zone-strategie er gratis bij. Als een externe integratie verwachtte dat de oude "eerste passende tafel"-logica bleef, kan een wijziging in een andere zone landen dan voorheen. Met `fill_strategy_enabled = false` blijft het gedrag identiek aan vandaag, dus dit raakt alleen restaurants die de strategie expliciet hebben aangezet.
