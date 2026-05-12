## Doel

Agenda-layout exact zoals in de screenshot: alles boven de rode lijn sticky, alleen het tafel-grid scrollt. De datum-tekst tussen "Lijst" en "Spring naar:" vervalt — de datum staat al rechts in de toolbar (incl. datepicker).

## Layout (boven de rode lijn = sticky)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [Tijdlijn][Lijst]   Spring naar:[Serre][Restaurant][Podium]              │  ← rij 1
│                                       [zoom −][100%][zoom +][⤢][↕][‹][📅 12 mei 2026][›] │
│ Tip: tik op een leeg tijdvak om snel een reservering toe te voegen.      │  ← rij 2
│ Tafel │ 11:00  12:00  13:00  14:00  15:00 …                              │  ← rij 3 (uren-as)
├══════════════════════════════════════════════════════════════════════════┤  rode lijn
│  10  │                                                                   │
│ Serre│                  ⟶ scrolt verticaal én horizontaal                │
│  11  │                                                                   │
│ …    │                                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Waarom de huidige sticky niet werkt

1. De agenda zit in `<Card class="overflow-hidden">` — `overflow-hidden` op een voorouder breekt `position: sticky`.
2. De uren-as is sticky binnen de horizontale-scroll-container; die container scrollt vertikaal mee met `<main>`.
3. De pagina heeft geen eigen scroll-viewport.

## Oplossing: pagina-eigen scroll-viewport

De agenda-pagina vult `<main>` volledig; alleen de body-zone scrollt. Daardoor staat de hele kop gewoon vast bovenin — geen sticky-trucs meer nodig.

### Wijzigingen in `src/pages/app/AgendaPage.tsx`

- Outer wrapper: `flex flex-col h-full min-h-0` (vult `<main>`).
- `<Card class="overflow-hidden">` vervangen door een platte `div` zonder overflow-hidden.
- **Header-stack** (vast, niet-scrollend):
  - **Rij 1** (`flex items-center gap-3`):
    - Links: view-switcher `Tijdlijn | Lijst` (nieuw, klein).
    - Direct daarna: `Spring naar:` + zone-knoppen (horizontaal scrollbaar binnen die rij op smal).
    - Rechts (`ml-auto`): toolbar — zoom-out / `100%` / zoom-in, fullscreen-toggle, row-zoom, vorige-dag, datepicker (`📅 12 mei 2026`), volgende-dag, "Vandaag" als niet-vandaag.
    - **Geen aparte datum-tekst** tussen "Lijst" en "Spring naar:" — datum is al zichtbaar in de datepicker rechts.
  - **Rij 2**: tip-tekst (klein, muted).
  - **Rij 3**: uren-as (`Tafel | 11:00 12:00 …`), horizontaal gesynced met de body.
  - Mobile-only zoom-rij vervalt; op smal collapsen we minder belangrijke knoppen achter een "…"-popover (zoom% blijft zichtbaar).
- **Body**: `flex-1 min-h-0 overflow-auto` — enige scrollende zone (vert. + horiz.). Bevat alleen de tafelrijen + nu-lijn.
- **Sync horizontale scroll** tussen rij 3 (uren-as) en de body via `onScroll` op de body die `scrollLeft` op de uren-as bijwerkt (uren-as krijgt `overflow-x: hidden`).
- `scrollRef` blijft de body voor zoom-recenter en "nu"-recenter. Logica voor zoom, pinch, jumpToZone, nu-lijn ongewijzigd.
- Lokale view-state `view: "timeline" | "list"`. "Lijst" rendert de bestaande `DayView`. Default = timeline.
- Fullscreen-knop toggelt een class op outer wrapper (`fixed inset-0 z-50 bg-background`).

### Wijziging in `src/components/AppShell.tsx`

`<main class="flex-1 overflow-auto">` → `<main class="flex-1 overflow-hidden min-h-0">` zodat agenda-pagina (en andere pagina's met `h-full`) volledige hoogte krijgen. Pagina's die niet expliciet hun eigen scroll regelen, krijgen een lichte `h-full overflow-auto` wrapper rond hun bestaande root-`<div>`. Geen functionele veranderingen.

## Toepassen op andere pagina's (zelfde patroon)

Pagina's met grote dataset + filterkop krijgen ook "kop vast, body scrollt":

- `src/pages/app/FloorModePage.tsx` — kop met zone-tabs/filters vast, alleen vloer-grid scrollt.
- `src/pages/app/ReservationsPage.tsx` — filters/tabs vast, lijst scrollt.
- `src/pages/app/LargeGroupsPage.tsx` — kop vast, lijst scrollt.
- `src/pages/app/GuestsPage.tsx` — zoek/filterbalk vast, gastenlijst scrollt.
- `src/pages/app/PreOrderDrinksPage.tsx` — kopfilters vast, lijst scrollt.
- `src/pages/app/WaitlistPage.tsx` — KPI-rij + filters vast, wachtlijst scrollt.

Per pagina: outer `flex flex-col h-full min-h-0`, kop in normale flow, body `flex-1 min-h-0 overflow-auto`. Geen `overflow-hidden` op tussen-cards. Settings- en informatiepagina's blijven ongewijzigd.

## Out of scope

- Geen functionele wijzigingen aan reserveringen, zoom-gedrag, zone-springen of de "nu"-lijn.
- Geen styling-revisie van knoppen/blokken behalve waar nodig om de nieuwe layout te laten kloppen.
- Browser-fullscreen API: alleen CSS-fullscreen nu; native API kan later.
