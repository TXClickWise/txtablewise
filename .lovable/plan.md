## Doel

1. Tafelcombinaties respecteren de zone fill-strategie (single-zone eerst, cross-zone als laatste fallback), met respect voor actieve zones (weer/tijd/groep).
2. Operator kan de fill-strategie volledig **uitschakelen** per restaurant. Dan valt het systeem terug op het oude gedrag: eerste passende vrije tafel, dan eerste passende combinatie — ongeacht zone-volgorde.

## 1. Datamodel (migratie)

- `table_combinations` krijgt `fill_priority int default 100` — optionele override per combinatie.
- Geen nieuwe vlag nodig op `restaurants`: de bestaande `fill_strategy_enabled` (uit eerdere migratie) is de master-schakelaar voor zowel losse tafels als combinaties.
- Geen RLS-wijzigingen.

## 2. Centrale helper uitbreiden

`supabase/functions/_shared/zone-fill.ts` krijgt een nieuwe functie:

```text
pickCombinationWithFillStrategy({
  combinations,            // alle actieve combinaties die qua capaciteit passen
  tablesById,              // map id -> TableRow (incl. zone_id)
  occupiedTableIds,        // set vrij/bezet
  zoneActivity,            // van resolveActiveZones
  occupancyByZone,
  prefersTerrace,
  partySize,
})
```

Algoritme:
1. Filter combinaties waarvan **alle** tafels vrij zijn (huidige logica behouden).
2. Markeer per combinatie:
   - `zoneIds` = unieke set zones van de tafels
   - `crossZone = zoneIds.size > 1`
   - `containsInactiveZone` = combinatie bevat tafel in een nu-niet-actieve zone
   - `terraceOnly` = alle tafels in `is_terrace` actieve zones
3. Sorteer:
   - eerst combinaties met `containsInactiveZone = false`
   - dan single-zone vóór cross-zone
   - binnen die groep: laagste effectieve `fill_priority` (combinatie-override → anders min van de zone-prio's van de bevatte tafels)
   - dan kleinste capacity-waste
   - dan alfabetisch op naam
4. Als `prefersTerrace=true` en er bestaat een `terraceOnly`-combinatie → die wint, anders flag `terrace_preference_unmet`.
5. Combinaties met `containsInactiveZone=true` mogen alleen gekozen worden als er **geen** alternatief is (laatste fallback) — operator-beslissing zichtbaar in `reason`.

## 3. Master-schakelaar "vul-strategie uit"

In `book_reservation/index.ts`:

```text
if (!restaurant.fill_strategy_enabled) {
  // pad A: eerste passende vrije tafel (volgorde tables.sort_order, capacity-fit)
  // fallback: findAvailableCombination (huidige, zone-agnostisch)
} else {
  // pad B: pickTableWithFillStrategy → pickCombinationWithFillStrategy
}
```

Hetzelfde pad gebruikt voor:
- `book_reservation` (widget + agent_api)
- `availability` (voor `available_table_count`): wanneer strategie uit staat, geen zone-filter — alle actieve tafels tellen mee.
- Walk-in `tableRecommendation.ts`: parameter `fillStrategy` blijft, maar default = restaurant-vlag.

## 4. UI

### `ZonesTablesSettings.tsx`
- Bovenaan staat al de toggle "Vul het restaurant in zone-volgorde". Onder de toggle:
  - Korte uitleg: "Uit = systeem kiest gewoon de eerstvolgende geschikte (combinatie van) tafel(s), zonder zone-volgorde of drempels."
  - Wanneer uit: zone-regels uitklap-panels en `fill_priority` arrows worden disabled/getoond met "niet actief".
- Combinaties-sectie (`TableCombinationsManager.tsx`):
  - Badge per combinatie: "Eén zone: Serre" of "Cross-zone: Serre + Restaurant".
  - Indicator "Bevat nu-niet-actieve zone (terras gesloten)" wanneer relevant.
  - Klein omhoog/omlaag pijltje voor `fill_priority` (alleen zichtbaar als strategie aan staat).

### Widget / agent
- Geen wijziging in gast-UX. Terras-checkbox blijft alleen zichtbaar als ≥1 zone `is_terrace=true` heeft.

## 5. Rapportage
- Geen wijziging in dit iteratie. Eerder gepland zone-bezettingsblok komt los.

## 6. Volgorde van uitvoering

1. Migratie: `ALTER TABLE table_combinations ADD COLUMN fill_priority int NOT NULL DEFAULT 100;`
2. `_shared/zone-fill.ts`: `pickCombinationWithFillStrategy` + unit tests in `src/test/`.
3. `book_reservation/index.ts`: master-schakelaar respecteren (pad A / pad B). Combinatie-fallback in pad B vervangen door nieuwe helper.
4. `availability/index.ts`: zone-filter conditioneel.
5. `tableRecommendation.ts`: default uit restaurant-vlag.
6. UI: uitleg + disabled-state in `ZonesTablesSettings.tsx`; badges + prio-arrows in `TableCombinationsManager.tsx`.
7. Memory-update `mem://features/zone-fill-strategy`: combinaties (single vóór cross-zone, inactive-zone als laatste fallback) + master-schakelaar.

## 7. Edge-cases

- Strategie uit + terras-voorkeur gast: voorkeur wordt soft-hint (kies eerst tafel/combinatie in `is_terrace`-zone als beschikbaar), maar zonder zone-drempels.
- Geen enkele actieve zone (alles geblokkeerd door weer/tijd): val terug op alle fitting + vrije tafels/combinaties, zodat reservering nooit valselijk wordt geweigerd.
- Combinatie met tafel zonder `zone_id`: telt als single-zone "geen zone", krijgt neutrale prio (`5000`) zoals losse tafels nu al.
