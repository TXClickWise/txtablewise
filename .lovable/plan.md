## Doel

De navigatie in `/app` opschonen zodat er geen dubbele menu's meer ontstaan, groepen inklapbaar zijn en "Drankjes vooraf" een eigen plek krijgt onder Instellingen in plaats van onder Gastcommunicatie.

## Wijzigingen

### 1. Dubbele "Instellingen" sub-sidebar weghalen (`src/components/AppSidebar.tsx`)
- De `settingsSubItems` (AI Host & Voice, Koppelingen, Reserveringen, Tafels & zones) staan nu als `SidebarMenuSub` onder de Instellingen-knop én verschijnen nogmaals in de aparte tweede sidebar op `/app/instellingen` (`SettingsPage.tsx`). Dat is dubbel en verwarrend.
- Oplossing: verwijder de `SidebarMenuSub` met die 4 snelkoppelingen. De Instellingen-knop wordt een gewone link naar `/app/instellingen`, waarbinnen de bestaande gegroepeerde settings-navigatie (Basis / Operatie / Gasten & communicatie / Techniek / Account) leidend is.

### 2. Hoofdsidebar inklapbare groepen
- De huidige `Group`-component rendert vaste groepen ("Snel naar", "Hospitality", "Beheer", "Admin"). Maak die inklapbaar met `Collapsible` (zelfde patroon als shadcn sidebar collapsibles), met state persistent in `localStorage` (key per groep, b.v. `sidebar.group.snel-naar`). Standaard open.
- "Admin"-groep krijgt dezelfde collapsible-behandeling.
- In collapsed (icon-only) sidebar-modus blijven groepen gewoon getoond zoals nu (geen header om in te klappen).

### 3. Instellingen-sectie zelf inklapbare groepen (`src/pages/app/SettingsPage.tsx`)
- De groepen Basis/Operatie/Gasten & communicatie/Techniek/Account worden ook `Collapsible` met onthouden open/dicht-state per groep (`localStorage`, key b.v. `settings.group.basis`). Standaard alle open.
- Mobiele horizontale pillen-fallback blijft ongewijzigd.

### 4. "Drankjes vooraf" verhuist van Gastcommunicatie naar Instellingen
- `src/pages/app/GastcommunicatiePage.tsx`: tab "Drankjes vooraf" verwijderen. Alleen "No-show preventie" en "Reviews & aftercare" blijven.
- Nieuwe settings-route `pre-orders` in `src/App.tsx` onder `/app/instellingen`, rendert het bestaande `PreOrderDrinksPage` component (geen herbouw, alleen verplaatsing).
- `SettingsPage.tsx`: voeg item "Drankjes vooraf" toe aan de groep "Gasten & communicatie" (icon `Wine` of `Beer` uit lucide) met `to="/app/instellingen/pre-orders"`.
- Legacy redirect bijwerken: `/app/drankjes` en `/app/gastcommunicatie?tab=drankjes` -> `/app/instellingen/pre-orders`.
- Sidebar-quicklink in `AppSidebar` (bestond niet als eigen item) niet toevoegen — blijft bereikbaar via Instellingen.

### 5. Verifieer
- Klikken op "Instellingen" in hoofdsidebar opent enkel `/app/instellingen` met de interne settings-nav; geen tweede sub-lijst meer in de hoofdsidebar.
- Groepen in beide sidebars klappen in/uit en onthouden state na refresh.
- Oude links naar `/app/gastcommunicatie?tab=drankjes` redirecten naar `/app/instellingen/pre-orders`.

## Buiten scope
- Geen wijzigingen aan de `restaurants.preorders_enabled` master-toggle of widget-logica — die blijft binnen de pre-orders pagina zelf werken.
- Geen visuele restyling buiten het collapsible-gedrag.
