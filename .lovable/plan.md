## Doel

Operators kunnen een tafel met één tap tijdelijk **Uit** (niet beschikbaar) zetten zonder hem te verwijderen. Gebruikt de bestaande `tables.is_active` kolom — die wordt al door alle auto-toewijzingsflows als harde filter gehanteerd. Geen schema-wijziging nodig.

## Wat er nu klopt (geen werk)

- `availability`, `book_reservation`, `guest_reservation`, `review_guest_change`, `public_api`, `reservation-utils`, `zone-fill`, `WalkInQuickSheet`, `AssignTableSheet` → filteren al op `is_active = true`.
- Dus zodra de toggle uit staat, valt de tafel automatisch overal weg uit auto- én handmatige pickers.

## Wijzigingen

### 1. Zones & Tables — tafellijst (`src/pages/app/settings/ZonesTablesSettings.tsx`)
- Voeg per tafelregel een **Switch "Beschikbaar"** toe (naast de prullenbak-knop), gebonden aan `t.is_active`.
- Toggle roept bestaande `updateTable(id, { is_active: bool })` aan (die functie bestaat al voor de andere velden).
- Visueel: rij krijgt `opacity-60` + badge "Uit" (subtiel, naast label) wanneer `is_active = false`.
- Grid van `grid-cols-12` aanpassen om ruimte te maken (label 2, zone 3, capaciteit 2, vorm 2, switch 2, delete 1).

### 2. Floor Plan editor (`src/components/floor-plan/FloorPlanEditor.tsx`)
- Query verwijdert nu `is_active = true` filter → ook inactieve tafels worden getoond (operator moet ze zien om te kunnen reactiveren of verplaatsen).
- Inactieve tafels: diagonaal gearceerd patroon + `opacity-50` + niet-draggable klikbaar (selecteren mag, slepen niet).
- Eigenschappen-paneel van geselecteerde tafel: extra Switch **"Beschikbaar voor reserveringen"**.

### 3. Floor Mode (operationeel scherm) — *check & licht aanpassen*
- Verifiëren dat inactieve tafels grijs/uit getoond worden en niet als "vrij" tellen voor walk-in suggesties. Als de pagina `is_active = true` al filtert: een visuele indicator toevoegen (badge "Uit") in plaats van helemaal verbergen — operator wil weten waarom een tafel "ontbreekt".
- (Concrete bestanden: `src/pages/app/FloorModePage.tsx` of onderliggende componenten — bij implementatie kort verifiëren.)

### 4. Microcopy
- Tooltip op de switch: *"Uit = tafel is tijdelijk niet beschikbaar voor reserveringen of walk-ins. Blijft zichtbaar op de plattegrond."*
- Toast bij uitzetten: *"Tafel {label} staat op niet-beschikbaar."*
- Toast bij aanzetten: *"Tafel {label} is weer beschikbaar."*

## Niet in scope

- Geen "Uit tot…" timer (auto-reactivering op tijdstip) — kan later als operators erom vragen.
- Geen schemamigratie.
- Geen wijziging aan `capacity_min/max = 0` gedrag (laten zoals het is).
- Geen aanpassing aan zone-fill of fill_priority logica.

## Verificatie

1. Tafel uitzetten in Zones & Tables → controleer dat:
   - Widget (`availability`) hem niet meer aanbiedt.
   - Walk-in lijst hem niet toont.
   - AssignTableSheet hem niet toont.
   - Floor Plan editor hem nog wél toont (gearceerd).
2. Tafel weer aanzetten → terug beschikbaar.
3. Bestaande reservering op nu-uit-gezette tafel blijft staan (geen cascade — verifieer alleen).
