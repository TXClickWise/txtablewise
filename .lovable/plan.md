## Wat ik op de screenshots zie

1. **Sidebar blijft op tablet permanent open** (zelfs op smal portrait), neemt ~320px en duwt de content weg → tabs verdwijnen rechts (`Tafels & z…`, `Ga…`), kolomkoppen worden afgeknipt (`erre`, `estaurant`, `odium`).
2. **Settings-tabs (`SettingsPage`)** schakelen pas op `lg` (1024px) over naar 2-koloms — op tablet portrait zie je dus de horizontale pillen-rij die rechts buiten beeld valt.
3. **Toggle-rijen** (Openingstijden) — `Switch` + label + 2 select-boxes naast elkaar zonder `shrink-0` → vervormde toggles op smalle breedtes.
4. **Agenda** mist een "nu"-lijn en zoom; horizontaal scrollt naar 11:00 i.p.v. naar de huidige tijd.

## Doelen

1. Sidebar verdwijnt automatisch onder 1280px (tablet portrait + landscape).
2. Settings-schermen passen netjes op tablet zonder vervormde controls.
3. Agenda krijgt een live verticale "nu"-lijn + zoom (knoppen + pinch).

---

## Plan

### 1. Sidebar collapsen onder 1280px

**`src/components/ui/sidebar.tsx`** — pas `SidebarProvider` + `Sidebar` aan zodat ze ook tablet als "mobile-like" behandelen:
- Voeg een tweede breakpoint-detect toe (`useIsTabletOrSmaller` op basis van `(max-width: 1279px)`).
- Onder 1280px: zelfde gedrag als huidige `isMobile` (Sheet-overlay i.p.v. vaste kolom).
- Vanaf 1280px: huidig desktop-gedrag.
- `SidebarTrigger` blijft beschikbaar in `AppShell`.

**`src/components/AppShell.tsx`** — `SidebarProvider` met `defaultOpen={false}` zodat de sheet bij eerste laad dicht is op tablet.

> Effect: alle `/app`-pagina's krijgen automatisch volledige breedte op tablet → settings-tabs, agenda en floor mode passen weer.

### 2. Form-controls niet meer vervormd

Globale fixes (raakt elke pagina, klein risico):
- `src/components/ui/button.tsx`: voeg `shrink-0` toe in de base classes.
- `src/components/ui/switch.tsx`: voeg `shrink-0` toe op de root.
- `src/components/ui/input.tsx`: voeg `min-w-0` toe in de base classes zodat inputs nooit hun container kapotduwen.

### 3. Settings tablet-fit

**`src/pages/app/SettingsPage.tsx`**
- Verlaag breakpoint van `lg:` naar `md:` voor de 2-koloms layout — kan nu omdat sidebar onder 1280px geen ruimte meer pakt.
- Settings-nav (`<aside>`): `md:max-h-[calc(100vh-7rem)] overflow-y-auto sticky md:top-4`.
- Mobile pillen-rij: niet meer nodig vanaf `md`.

**Specifieke pagina-fixes** (alleen plekken waar de screenshots aantonen dat het knelt):
- `OpeningHoursSettings`: dag-rij naar `grid grid-cols-[100px_auto_1fr_1fr] sm:gap-3 gap-2 items-center`, zodat Switch + tijdselects niet vervormen.
- `GeneralSettings` (URL-rij): `min-w-0` op input-wrapper, `shrink-0` op icon-buttons.
- `WidgetSettings` (kleurpicker + URL): zelfde behandeling.
- `ZonesTablesSettings`: tafelrij `flex-wrap` + `min-w-0` op naam-input.

### 4. Agenda: live "nu"-lijn + zoom

**`src/pages/app/AgendaPage.tsx`**

Live "nu"-lijn:
- State `now` met `useEffect` + `setInterval(60_000)`.
- Render alleen als geselecteerde dag = vandaag.
- Bereken `nowMin = (now.getHours()-START_HOUR)*60 + now.getMinutes()`; verberg buiten `[0, totalMinutes]`.
- 2px verticale `bg-primary` lijn over volledige hoogte van het rooster, met klein bolletje + tijdlabel boven in de header (`z-20`, `pointer-events-none`).
- Auto-scroll bij eerste render (en bij dagwissel naar vandaag) naar `nowMin*PX_PER_MIN - viewportWidth/3`. Ref op de `overflow-x-auto`-container.

Zoom:
- `PX_PER_MIN` van constante naar state: `useState(2)`, range 1 → 6 in stappen van 0.5.
- Knoppen `−` / `+` in `PageHeader.actions` met huidige zoom als label (bv. `100%`).
- Pinch op touch: `pointerdown`/`pointermove`/`pointerup` op de scroll-container; bij 2 actieve pointers schaal `pxPerMin` proportioneel met afstand-ratio, geclamped op range. `touch-action: pan-x pan-y` op de container.
- Bij zoomwijziging: bewaar centerTime vóór zoom en herbereken `scrollLeft` ná render zodat het zichtpunt stabiel blijft.
- `totalWidth = totalMinutes * pxPerMin` — alle bestaande positionering blijft via dezelfde variabele werken.

---

## QA na implementatie

In preview op 820×1180 én 1180×820:
- `/app/floor` → sidebar dicht, hamburger werkt, content vult breedte.
- `/app/instellingen` (Algemeen, Openingstijden, Reserveringen, Online reserveren, Tafels & zones, Gasten, AI & Voice) → geen horizontale scroll, knoppen/toggles niet vervormd, alle tabs zichtbaar.
- `/app/agenda` → verticale "nu"-lijn op huidige tijd, +/− knoppen werken, pinch-zoom werkt op touch, view scrolt automatisch naar nu.

## Out of scope

- Settings-pagina's die niet op de screenshots staan (Berichten, Integraties, API & webhooks, Abonnement) krijgen alleen indirect baat via de globale `Switch`/`Button`/`Input`-fix; geen aparte refactor.
- Visueel redesign van de settings-nav blijft hetzelfde.
