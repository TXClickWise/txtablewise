## Doel
Operator-UI onder `/app` ook in het Engels beschikbaar maken. Scope = shell + kernpagina's. Taalvoorkeur per gebruiker, opgeslagen op het profiel. Widget/gast-UI blijft ongewijzigd.

## Scope van vertaling (deze ronde)
**Wel** (shell + kern):
- `AppShell`, `AppSidebar`, `AppHeader`, `settings-nav`, sidebar-secties (Admin, Settings, etc.)
- `PageHeader`, `TabbedPage`, `PlaceholderPage`, lege staten, generieke knoppen
- Pagina's: `TodayPage`, `AgendaPage` + `AgendaTabsPage`, `ReservationsPage`, `GuestsPage` + `GastenTabsPage`, `ReportsPage`, `SettingsPage` (hoofdscherm + lijst van sub-instellingen)
- Gedeelde dialogs die hierop leunen: `ReservationDetailDialog`, `WalkInDialog`, `StatusBadge`, `ChannelBadge`, `PendingBadge`
- Toast-meldingen en bevestigingen die in deze pagina's voorkomen

**Niet nu** (blijft NL, label "Nederlands only" niet nodig — gewoon onveranderd):
- Sub-pagina's van Settings (Subscription, Branding, Voice Agent, ClickWise, POS, Email templates, etc.)
- FloorMode/FloorPlan, Waitlist, NoShowPrevention, Reviews, PreOrders, LargeGroups, Integration Hub/Logs, Pilot, Admin-pagina's, Onboarding wizard, Help
- Per pagina later in te plannen batches

## Taalkeuze
- Nieuwe kolom `profiles.ui_locale text not null default 'nl'` (waarden `nl` / `en`)
- Bestaande RLS op `profiles` dekt update door eigenaar al; geen nieuwe policy nodig
- Bij login → `ui_locale` lezen, `i18n.changeLanguage()` aanroepen vóór render van `/app`
- Taalwissel in `AppHeader` user-menu (NL / EN) → update profiel + `setI18nLocale`
- Widget/manage-flows blijven hun eigen detectielogica gebruiken (URL `?lang=`, restaurant.locale, browser); operator-keuze beïnvloedt die niet

## i18n-infrastructuur
- Nieuwe namespace `app` toevoegen aan `src/lib/i18n/index.ts` met `nl` + `en` bestanden:
  - `src/lib/i18n/locales/nl/app.json`
  - `src/lib/i18n/locales/en/app.json`
- Structuur per sectie: `nav.*`, `header.*`, `common.*` (knoppen, statussen), `today.*`, `agenda.*`, `reservations.*`, `guests.*`, `reports.*`, `settings.*`, `dialogs.reservation.*`, `dialogs.walkIn.*`, `badges.*`, `toasts.*`
- DE/FR voor nu: alias naar NL (operator-keuze biedt alleen NL/EN aan; back-office i18n breidt later uit)
- `useTranslation('app')` in alle aangepaste componenten

## Stappen
1. **Migratie** — `profiles.ui_locale` toevoegen (default `'nl'`)
2. **i18n-uitbreiding** — `app` namespace registreren, lege NL/EN bestanden aanmaken
3. **Bootstrap** — in `RequireAuth` / app-laag `ui_locale` van profiel ophalen en `setI18nLocale` aanroepen vóór render
4. **Taalwissel** — knop in `AppHeader` user-menu (NL/EN), schrijft naar `profiles.ui_locale` + lokale state
5. **Shell vertalen** — `AppSidebar`, `AppHeader`, `settings-nav`, `PageHeader`, `TabbedPage`, `PlaceholderPage`, generieke badges
6. **Kernpagina's vertalen** — Today, Agenda(+Tabs), Reservations, Guests(+Tabs), Reports, Settings-hoofdscherm
7. **Dialogs** — `ReservationDetailDialog`, `WalkInDialog` (alle statiek strings + toasts in deze flow)
8. **NL-strings extraheren naar `nl/app.json`** terwijl componenten worden omgezet; EN-vertaling 1-op-1 in `en/app.json`
9. **Verificatie** — preview in beide talen, sidebar/kernpagina's, dialog open/sluit, toast tekst, taalwissel persisteert na reload

## Out of scope (expliciet)
- Geen wijziging aan widget, manage-pagina's, e-mailtemplates of edge functions
- Geen vertaling van Settings sub-pagina's of de niet-kernpagina's; die blijven NL en worden later per batch opgepakt
- Geen DE/FR voor operator-UI nu

## Technische details
- Storage: `profiles.ui_locale text not null default 'nl' check (ui_locale in ('nl','en','de','fr'))`
- Cache: `ui_locale` ook in localStorage zetten zodat de juiste taal direct bij eerste render actief is (geen flash NL→EN)
- Geen wijziging aan `detectLocale.ts` (die blijft voor gast/widget); operator-flow gebruikt eigen pad via profielwaarde
