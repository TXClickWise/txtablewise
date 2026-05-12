## Wat ik in de screenshot lees

De annotaties op de Agenda-view vragen vier concrete dingen:

1. **Restaurantnaam rechts uitlijnen** in de bovenste app-balk (nu staat hij midden/links naast de Vandaag/Agenda/… tabs en wordt op smalle viewports verborgen of afgekapt).
2. **Datum (Dinsdag 12 Mei 2026) duidelijk linksboven** — direct naast/onder de tabs *Tijdlijn / Lijst*.
3. **Toolbar (zoom %, in/uitzoomen, rij-zoom, vorige/volgende dag, datumkiezer) rechtsboven** in dezelfde rij als de datum.
4. **Sticky header**: de hele bovenkant (datum + toolbar + "Spring naar:" zone-knoppen + tip-balk + uren-as) moet bij verticaal scrollen en bij horizontaal zoomen vast bovenaan blijven. Het agenda-grid eronder is wat scrollt en schaalt.

Daarnaast vraagt de gebruiker meer ruimte: het scherm wordt nu gekneld door `max-w-[1600px] mx-auto p-4 sm:p-6`, dat wil hij ruimer.

## Plan

### A. AgendaPage (`src/pages/app/AgendaPage.tsx`)

**Volle breedte**
- Vervang container `p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4` door iets als `px-2 sm:px-3 pt-2 pb-3 space-y-2` zonder max-width, zodat de tijdlijn de hele beschikbare breedte krijgt.
- Card-wrapper rond de agenda krijgt `rounded-md` (i.p.v. lg) en eventueel geen schaduw, om kostbare horizontale ruimte aan rand te besparen.

**Sticky toolbar + zonebar (één samengestelde sticky-stack)**

Herorden in deze volgorde, allemaal `sticky top-0` (binnen de pagina-scroll, dus onder de app-header):

1. Rij 1 — links datum (`format(date, "EEEE d MMMM yyyy")` capitalized), rechts de bestaande toolbar (zoom-, rij-zoom-, prev/next-, datumkiezer-knoppen). Mobile blijft de huidige aparte mobiel-zoomrij bestaan, maar onder rij 1 in dezelfde sticky stack.
2. Rij 2 — "Spring naar:" zone-knoppenbalk (alleen tonen als `zoneGroups.length > 1`).
3. Rij 3 — Tip-balk ("Tip: tik op een leeg tijdvak…").
4. Rij 4 — Uren-as header (Tafel-kolomheader + halve-uur labels).

Implementatie: de `Card` rond de agenda wordt `flex flex-col` met de header-blokken in een `sticky top-0 z-20 bg-card` wrapper, en daaronder een aparte scroll-container die alleen de rijen bevat (huidige `scrollRef`). Belangrijk: de uren-as-header moet horizontaal mee-scrollen met het grid (zelfde scroll-container), maar verticaal blijft de hele header-stack staan. Praktisch: behoud de huidige sticky-strook-met-uren binnen de horizontale scroll-container, en zet datum/toolbar/zonebar/tip in een outer sticky div daarboven.

**Restaurantnaam-locatie:** blijft in `AppShell.tsx`, niet in AgendaPage.

### B. App-header restaurantnaam rechts uitlijnen (`src/components/AppShell.tsx`)

- Verwijder de `hidden md:block` op het naam-blok zodat hij vanaf sm: zichtbaar is.
- Geef het naam-blok `ml-auto` zodat hij altijd helemaal rechts in de header staat, los van wat de OperationTabBar doet.
- Verruim `max-w-[180px]` naar bv. `max-w-[260px] lg:max-w-[360px]` zodat "Pannenkoekenhuys & Restaurant Eigenwijs" niet zo snel wordt afgekapt; behoud `truncate` voor lange namen.

### C. Zelfde "meer ruimte"-behandeling voor andere operationele schermen

Voor schermen die net als Agenda tablet-first zijn en veel data tonen, max-width-clamps weghalen / verlagen en padding krimpen. Concreet:

- `src/pages/app/ReservationsPage.tsx` — verwijder `max-w-[1600px] mx-auto`, verlaag padding (was `p-4 sm:p-6`).
- `src/pages/app/LargeGroupsPage.tsx` — verwijder `max-w-[1400px] mx-auto`.
- `src/pages/app/GuestsPage.tsx` — verwijder `max-w-7xl`, behoud lichte padding.
- `src/pages/app/FloorModePage.tsx` (loading state heeft `max-w-3xl mx-auto`) — laat staan; de actieve modus is al volle breedte.
- `src/pages/app/ReportsPage.tsx` — verlaag `max-w-7xl` clamp naar volle breedte (rapportages tonen brede tabellen / grafieken).
- `src/pages/app/PreOrderDrinksPage.tsx` — `max-w-6xl` weg of naar volle breedte.

Schermen die **wel een leesbreedte-clamp houden** (geen brede grids, vooral formulieren/inhoud): Instellingen-subpagina's, KoppelingenPage / IntegrationHubPage / IntegrationsPage / POSIntegrationPage / PilotReadinessPage / OnboardingWizardPage / NoShowPreventionPage / AIHostPage. Daar werkt een clamp juist beter voor leesbaarheid.

## Acceptatiecriteria

- In Agenda-view blijft de datum + toolbar + "Spring naar:"-balk + uren-as zichtbaar tijdens horizontaal én verticaal scrollen / zoomen van het grid.
- Datum staat linksboven, toolbar staat rechtsboven, in één rij.
- Restaurantnaam staat in de app-header rechts uitgelijnd, ook op tablet-breedtes (≥sm), zonder afgekapt te worden tot een paar tekens.
- Agenda en de andere genoemde operationele pagina's gebruiken de volledige breedte van de viewport (geen `max-w-*` clamp), met minimale buitenpadding zodat het grid maximale ruimte krijgt.
- Geen functionele regressie: zoom, prev/next dag, datumkiezer, "Spring naar zone", klikbare kwartiercellen en reservering-blokken werken zoals nu.

## Open punten waar ik aannames maak (laat het weten als je iets anders wil)

- Ik laat de mobile/tablet-zoom-knoppenrij staan (nu een aparte rij onder de hoofd-toolbar). Op desktop staan alle knoppen in één rij; op smal blijven ze onder elkaar maar binnen dezelfde sticky stack.
- Ik voeg **geen** fullscreen-knop toe (in screenshot leek een expand-icoon te staan, maar dat is mogelijk de bestaande "rijen hoger/lager" iconen). Als je echte fullscreen wilt, geef het aan, dan voeg ik er een toe.
- Voor "andere schermen" pak ik de bovengenoemde lijst. Als je nog een specifiek scherm hebt waar het ook moet, zeg het erbij.
