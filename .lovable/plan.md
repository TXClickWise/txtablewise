## Doel

1. **Instellingen → Tafels & zones**: zones zelf rangschikken door te slepen. Volgorde wordt opgeslagen in `zones.sort_order` (kolom bestaat al).
2. **Agenda → Tijdlijn**: de verticale "Tafel"-kolom krijgt een onderverdeling per zone (sticky zone-koptekst boven de bijbehorende tafelrijen), in dezelfde volgorde als ingesteld.

## Aanpak

### A. Zones sleepbaar maken (`src/pages/app/settings/ZonesTablesSettings.tsx`)

- Per zone-rij een drag-handle icoon (`GripVertical`, links naast het naam-input). Hele rij wordt `draggable`, sleep wordt via de handle gestart (touch-vriendelijk).
- Native HTML5 drag-and-drop (geen nieuwe dependency): `onDragStart` zet bron-index, `onDragOver` toont drop-indicator (border-top/bottom), `onDrop` voert reorder uit.
- Bij drop: lokale state direct bijwerken (optimistic), daarna voor elke gewijzigde zone `sort_order` opslaan in DB. Bij fout: `load()` opnieuw + toast.
- Nieuwe zones krijgen al `sort_order = zones.length` (bestaande logica blijft).

### B. Tijdlijn-kolom groeperen per zone (`src/pages/app/AgendaPage.tsx`)

- Query `tables` aanvullen met `zones(name, sort_order)` en in JS sorteren op `(zone.sort_order, label)` zodat de volgorde uit instellingen overal doorwerkt (chips "Spring naar", plattegrond-tabs, tafelrijen).
- Zones zonder `sort_order` (NULL) of tafels zonder zone (`Overig`) komen onderaan.
- In de tafellijst-render (rond regel 605): vóór de eerste rij van elke nieuwe zone een sticky zone-header injecteren:
  - `sticky left-0` binnen de scroll-container, breedte = `TAFEL_COL_W`, achtergrond `bg-muted/40`, kleine uppercase zone-naam, met aantal tafels.
  - Tafels eronder behouden hun bestaande layout; de losse zone-naam onder de tafellabel (regel 624) wordt verwijderd want redundant geworden.
- "Spring naar"-chips (regel 470-485) scrollen naar de zone-header in plaats van de eerste tafel.

### C. Geen wijzigingen aan publiek widget/booking-logica
Alleen UI/sortering. `bookable_online` blijft de bron voor widget-zichtbaarheid.

## Acceptatiecriteria

- In Instellingen kan ik zones via drag-handle herordenen; nieuwe volgorde blijft na refresh.
- In Agenda → Tijdlijn zie ik per zone een kop boven de tafels, in de ingestelde volgorde.
- "Spring naar"-chips, plattegrond-tabs en floor-zone-selector volgen dezelfde volgorde.
- Geen regressie in walk-in / reservering-creatie of widget-zone-filtering.

## Bestanden

- `src/pages/app/settings/ZonesTablesSettings.tsx` — drag-reorder + persist `sort_order`.
- `src/pages/app/AgendaPage.tsx` — query uitbreiden, sorteren, zone-header-rijen renderen.
