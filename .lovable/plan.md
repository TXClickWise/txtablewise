## Wat ik nu wel zie en wat nog mist

In jouw screenshots staan status-knoppen **wél** al inline bij:
- **Vandaag** — kaartjes met *Heropenen / Afgerond / Annuleer*
- **Agenda → Lijst** — kaartjes met *Aan tafel / No-show / Annuleer / Heropenen*

Status-knoppen **ontbreken nog** bij:
1. **Agenda → Tijdlijn** — gekleurde blokjes openen wel de detail-dialog, geen snelmenu op het blok zelf
2. **Agenda → Plattegrond** — tafelkaartjes met reservering geen actie-knoppen
3. **Vloer-pagina** — grote tafelkaarten geen status-actie

In de **detail-popup** staat de quickbar nu pas helemaal onderaan — niet werkbaar, je moet steeds eerst scrollen.

Daarnaast is de **grote-groep-aanvragen indicator** alleen nog een kleine badge in de sidebar. Die moet weer prominent op Vandaag + Agenda.

## Voorstel

### A. Quickbar bovenaan in detail-popup en zijdeur
In `ReservationDetailDialog.tsx` en `reservations/ReservationDetailSheet.tsx`:
- **"Status wijzigen"-blok verplaatsen** van onderin naar **direct onder de header** (boven gastblok, no-show preventie, drankjes, etc.).
- Visueel sterker frame: `bg-card border-2 border-primary/20 shadow-sm p-4`, kop met icoon "Status van reservering" + regel *"Status nu: [badge]"*.
- Bestaande quickbar onderin verwijderen (één plek, niet dubbel).

### B. Snelmenu op tijdlijn-blokjes (Agenda → Tijdlijn)
In `src/components/reservations/views/TableGridView.tsx`: het blokje wrappen in een **Popover** die opent op klein "⋯"-knopje rechtsboven het blok (kort tikken op blok blijft = detail openen). Popover-inhoud:
- Gastnaam + tijd + party-size kop
- `<ReservationStatusQuickBar layout="grid" size="md">`
- Linkje "Open details"

### C. Snelmenu op plattegrond-tafelkaarten (Agenda → Plattegrond)
Tafelkaart met reservering krijgt zelfde Popover-patroon via kebab-knop in de hoek. Lege tafel blijft direct openen om snel reservering toe te voegen.

### D. Snelmenu op Vloer-tafelkaarten
In `src/pages/app/FloorModePage.tsx`: de bestaande Sheet krijgt bovenaan een **actie-rij** met `ReservationStatusQuickBar size="lg" layout="grid"` (grote touch-targets). Op desktop ook een Popover via kebab-knop op de kaart zelf.

### E. Grote-groep aanvragen weer prominent
- **Vandaag (`TodayPage.tsx`)**: alert-tegel tussen KPI-rij en "Reserveringen vandaag" — *"X groepsaanvragen wachten op goedkeuring"* + knop "Bekijken" → `/app/reserveringen/grote-groepen`. Alleen tonen als count > 0.
- **Agenda (`AgendaPage.tsx`/`AgendaTabsPage.tsx`)**: smalle banner bovenaan boven de tab-switcher Tijdlijn/Lijst/Plattegrond.
- Sidebar-badge blijft staan.

## Geen wijzigingen aan
- `manage_reservation` edge function (transitions zijn vorige ronde al verruimd)
- `ReservationStatusQuickBar` interne logica — wordt alleen op nieuwe plekken hergebruikt
- Vandaag- en Lijst-kaartjes (werkt al)

## Bestanden
- `src/components/ReservationDetailDialog.tsx` — status-blok bovenaan, sterker frame
- `src/components/reservations/ReservationDetailSheet.tsx` — idem
- `src/components/reservations/views/TableGridView.tsx` — Popover op tijdlijn-blok + tafelkaart
- `src/pages/app/FloorModePage.tsx` — quickbar bovenaan tafel-sheet + kebab-Popover
- `src/pages/app/TodayPage.tsx` — grote-groep alert-tegel
- `src/pages/app/AgendaPage.tsx` (of `AgendaTabsPage.tsx`) — grote-groep banner
