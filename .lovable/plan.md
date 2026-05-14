## Doel

- PWA-scope beperken tot staff-app, zodat landingspagina, reserveringswidget, gastenbeheer en helppagina's **in een gewone browsertab** openen.
- Login blijft **binnen de PWA** zodat een geïnstalleerde tablet niet uit de app springt bij een sessie-expiry.

## Eindgedrag per route

| Route | Waar opent het |
|---|---|
| `/app/*` (staff, admin, instellingen) | **PWA** |
| `/app/login` (nieuw) | **PWA** |
| `/` landing | Browser |
| `/r/:slug`, `/reserveer/:slug`, `/book/:slug` reserveringswidget | **Browser** |
| `/r/manage/:token` gastenbeheer | Browser |
| `/auth` (legacy) | Browser — redirect naar `/app/login` |
| `/unsubscribe` | Browser |

## Wijzigingen

### 1. `public/manifest.json`
- `scope` terug naar `"/app"`.
- `start_url` blijft `"/app"`.

Gevolg: alle URL's buiten `/app/*` (inclusief `/r/:slug`) openen automatisch in de standaard browser, ook als de gebruiker de PWA heeft geïnstalleerd. Dit is precies hoe iOS/Android PWA-scoping werkt — out-of-scope navigaties springen uit de standalone app.

### 2. Login binnen PWA-scope
Om login niet uit de PWA te laten springen:
- Nieuwe route `/app/login` (publiek, geen `RequireAuth`) die dezelfde `Auth`-pagina rendert.
- `RequireAuth` redirect naar `/app/login` i.p.v. `/auth` wanneer de gebruiker in PWA-context zit. Eenvoudigst: altijd naar `/app/login` redirecten, en `/auth` als legacy-redirect naar `/app/login` laten staan.

### 3. Bestaande installs
PWA-manifestvelden (`scope`, `start_url`) zijn **gepind op installatiemoment** — bestaande installaties op tablets blijven de oude scope `/` gebruiken tot ze opnieuw worden geïnstalleerd. Korte herinstallatie-instructie nodig voor pilot-tablets die de PWA al hadden.

## Niet wijzigen
- Geen service worker, geen caching-gedrag.
- Routerstructuur in `App.tsx` blijft verder gelijk; alleen `/app/login`-route en `RequireAuth`-redirect aanpassen.
- Geen wijzigingen aan widget, landing of helppagina's nodig — die vallen automatisch buiten scope.

## Bestanden

- `public/manifest.json` — `scope` → `/app`.
- `src/App.tsx` — `<Route path="login" element={<Auth />} />` toevoegen onder `/app`, en `/auth` redirecten naar `/app/login`.
- `src/components/RequireAuth.tsx` — redirect-target `/app/login`.
