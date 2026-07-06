
# Fixes voor groepen >8 personen — resterende blokkades

De walk-in flow werkt nu met tafelcombinaties. Een audit van alle andere boekingspaden toonde nog **11 issues**. Hieronder een gefaseerd plan van kritiek naar cosmetisch.

## Fase 1 — Kritiek (data-loss & harde blokkades)

### 1. `manage_reservation` verliest tafelcombinaties bij elke edit
`supabase/functions/manage_reservation/index.ts`
- Alleen de eerste `reservation_tables[0].table_id` wordt bewaard → bij elke wijziging (tijd, datum, party) verandert een 2-tafelcombinatie voor 10p in een 1-tafel toewijzing (**data-loss**).
- Bij herplaatsing wordt alleen naar losse tafels gezocht — combinaties worden nooit geprobeerd, dus edits van grote groepen falen met `no_table_available`.

**Fix:** in `doUpdate`:
- Lees álle huidige `reservation_tables`, niet enkel de eerste.
- Roep na `findAvailableTable` bij `null` ook `findAvailableCombination` (of `pickCombinationWithFillStrategy` als `fill_strategy_enabled`) aan, gelijk aan `book_reservation`.
- Vervang `reservation_tables` met de volledige set uit het resultaat.

### 2. `AssignTableSheet` kan geen combinatie toewijzen
`src/components/reservations/AssignTableSheet.tsx`
- `picked: string | null` → operator kan maar 1 tafel kiezen; bestaande combinatie wordt overschreven.

**Fix:** UI uitbreiden met een tab/sectie "Tafelcombinaties" (via `table_combinations`) naast losse tafels. Selectie wordt `{ kind: "single" | "combo", ids: string[] }`. `resService.update` uitbreiden zodat het meerdere `reservation_tables` kan wegschrijven (mag via directe insert/delete op `reservation_tables` na de update — patroon uit `book_reservation`).

## Fase 2 — Hoog (widget & operator formulier)

### 3. Widget chip-picker capt op 8 als `max_party_size_online` niet gezet is
`src/pages/ReserveWidget.tsx` regel 391
- Fallback `?? 8` → gasten met 9+ moeten het verborgen tekstveld vinden.

**Fix:** fallback naar `large_group_max_online_request ?? max_party_size_online ?? 12` en chips genereren tot dat maximum, met visuele scheiding vanaf `large_group_threshold` ("grote groep — aanvraag").

### 4. `ReservationFormSheet` prefill dwingt losse tafel af na booking
`src/components/reservations/ReservationFormSheet.tsx` regel 133-136
- Als operator vanuit floor plan met een `prefill.tableId` boekt en de engine kende een combinatie toe, wordt die combinatie post-hoc overschreven door één tafel.

**Fix:**
- `prefill` uitbreiden met optionele `tableIds?: string[]` / `combinationId?: string`.
- Sla de post-boeking table-force over wanneer party > single table capacity of wanneer engine al ≥2 `reservation_tables` heeft opgeleverd.

## Fase 3 — Middel (consistentie engine)

### 5. `availability` en `book_reservation` gebruiken verschillende paden
`supabase/functions/availability/index.ts` regel 237
- `availability` roept altijd de legacy `findAvailableCombination` aan, ook als `fill_strategy_enabled` aan staat. `book_reservation` gebruikt dan `pickCombinationWithFillStrategy`. → slot toont soms "vol" terwijl booking wel lukt (of omgekeerd).

**Fix:** zelfde branch in `availability` als in `book_reservation`.

### 6. `guest_reservation` gasten-selfservice heeft geen harde cap
`supabase/functions/guest_reservation/index.ts` regel 484
- Gast kan wijziging naar 50p indienen → gaat naar `pending_review`.

**Fix:** hard reject boven `large_group_max_online_request ?? 20` met duidelijke reden.

### 7. Zone `max_party_size` blokkeert combinatie-pad zonder fallback
`supabase/functions/_shared/zone-fill.ts` regel 82
- Single-tafel-pad heeft een fallback als alle zones inactief zijn; combinatie-pad heeft die niet expliciet.

**Fix:** in `pickCombinationWithFillStrategy` dezelfde fallback: als alle zones geblokkeerd zijn op `partySize > max_party_size`, alsnog alle combinaties overwegen.

## Fase 4 — Laag (opschoon)

### 8. UI/engine threshold mismatch (`?? 8` vs `|| 9`)
`ReservationFormSheet.tsx` regel 77 → align op `?? 9`.

### 9. Waitlist party size cap
`src/services/publicBooking.ts` — voeg zod `max(50)` toe (of `large_group_max_online_request`).

### 10. `public_api` cap-check
`supabase/functions/public_api/index.ts` regel 388 — early reject `> 50` met nette errorcode voor externe API-consumers.

## Technische details

- Nieuwe helper `applyReservationTables(supabase, reservationId, tableIds[])` in `_shared/reservation-utils.ts` — deleteert bestaande koppelingen en insert nieuwe set, gebruikt door book/manage/AssignTable.
- `reservations.update` service kan uitbreiden met optionele `table_ids?: string[]` die de helper aanroept.
- Geen schemamigraties nodig — `reservation_tables` ondersteunt al meerdere rijen per reservering.
- Geen wijzigingen aan design tokens of styling.

## Scope-uitsluitingen

- Geen wijziging aan tafelcombinatie-configuratie UI (`ZonesTablesSettings`) — die is al werkend.
- Geen wijziging aan `LargeGroupsPage` flow (die werkt via `large_group_requests`, niet directe booking).
- Geen aanpak van eventuele AI-Host/voice paden buiten book_reservation — die delegeren al naar dezelfde engine en profiteren automatisch van fix #1/#5.

## Volgorde van uitvoering (aanbevolen)

Fase 1 eerst (voorkomt actieve data-loss). Fase 2 daarna (raakt gastreis en operator dagelijks). Fase 3+4 kunnen in één latere pass.
