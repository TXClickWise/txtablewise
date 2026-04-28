# Online reserveringswidget — embed, link, QR & instellingenpagina

## Uitgangspositie
- ✅ Volledig werkende widget op `/r/:slug`, `/reserveer/:slug`, `/book/:slug` (`src/pages/ReserveWidget.tsx`, 869 regels)
- ✅ Stappen: party → date → time → details → confirm, met large-group en waitlist fallback
- ✅ Gebruikt al `getAvailability()` + `createPublicReservation()` uit `src/services/publicBooking.ts` — zelfde edge functions als interne flow, AI Voice Agent en publieke API → **geen aparte logica nodig**
- ✅ Mobiel-first responsive, sticky header, grote touch-targets, progressive disclosure
- ❌ Geen embed-codegenerator, geen QR, geen brand-styling toegepast, geen URL-prefill voor party/date, geen taal-override
- ❌ Geen settings-pagina "Online reserveren / Widget"

## Aanpak
**Geen nieuwe booking-logica.** Twee gerichte uitbreidingen:

### 1. `src/pages/ReserveWidget.tsx` — URL params + brand styling
Lees deze nieuwe `searchParams`:
| Param | Effect |
|---|---|
| `party=4` | Initiële `partySize`, slaat party-stap eventueel niet over (gast kan nog wijzigen) |
| `date=2026-04-30` | Initiële `date`, ISO yyyy-MM-dd |
| `time=19:00` | Pre-select tijdslot wanneer beschikbaarheid laadt |
| `lang=nl\|en` | Voor toekomstige i18n; nu alleen `<html lang>` zetten + dateformat |
| `hide_logo=1` | Verbergt het TableWise-logo in de header |
| `accent=#hex` | Override van `restaurants.brand_primary`, alleen geldig hex |
| `source=...` | Bestaand (channel attribution) |

Brand styling (zonder hardcoded kleuren in components):
- Restaurant-query uitbreiden met `brand_primary`, `logo_url`
- In `useEffect` na laden: zet `--primary` en `--ring` als CSS-variable op de root van het widget-`<div>` met de hex (geconverteerd naar HSL via een kleine helper). Zo blijft alle bestaande `bg-primary` etc. werken zonder componentwijzigingen.
- Logo van het restaurant tonen in header bij `restaurant.logo_url` als `hide_logo` niet gezet is. TableWise-merk wordt subtieler ("powered by") onderaan.

Validatie: hex met `^#[0-9a-fA-F]{6}$` regex; ongeldige waarden negeren stilletjes.

### 2. `src/pages/app/settings/WidgetSettings.tsx` — nieuwe pagina
Alles op één scherm, twee kolommen op desktop, gestapeld op mobiel:

**Linker kolom — Configuratie**
- **Brand**: kleurkiezer (gekoppeld aan `restaurants.brand_primary`), upload-/URL-veld voor `logo_url` (alleen URL voor nu, file upload bestaat nog niet — duidelijk gemarkeerd)
- **Standaarden**: aantal personen (1–8), datum (vandaag/morgen/specifiek), tijd (HH:mm of leeg), taal (nl/en) — komen als URL-params terecht in alle gegenereerde links
- **Toon TableWise-logo**: switch (default aan)

**Rechter kolom — Verspreiden**
- **Directe link**: `https://<host>/r/<slug>?party=…&date=…` met copy-button
- **Embed script**: `<iframe>` snippet met de gekozen defaults, copy-button. Inclusief `loading="lazy"` en responsive sizing (style: width 100%, min-height 720px, border 0)
- **QR-code**: `qrcode.react` SVG, downloadbaar als PNG via canvas-conversie. Onder de QR-code: link naar de exacte URL.

**Volledige breedte — Preview**
- Tabs/segments: **Mobiel** (375×667) en **Desktop** (1024×768) — frame met `<iframe src=…>` op de juiste viewport. Live-update wanneer instellingen veranderen.

### 3. Routing & navigatie
- Nieuwe route in `src/App.tsx`: `instellingen/widget` → `<WidgetSettings />`
- Nieuw item in `SettingsPage.tsx` onder groep "Operatie": "Online reserveren" met `Globe`-icoon

### 4. Persistentie
- `restaurants.brand_primary` en `restaurants.logo_url` bestaan al → direct opslaan via update
- Defaults voor party/date/time/taal hoeven niet in DB; ze leven alleen in de gegenereerde URLs (one-shot configuratie). Optioneel later in `restaurants.metadata` opslaan zodat gebruikers ze terugzien — nu lokaal per sessie.

## Bestanden
**Nieuw**
- `src/pages/app/settings/WidgetSettings.tsx`

**Aangepast**
- `src/pages/ReserveWidget.tsx` — `RestaurantInfo` uitgebreid met `brand_primary` + `logo_url`, URL-param parsing voor `party/date/time/lang/hide_logo/accent`, brand styling via CSS-variabelen, optionele logo render
- `src/App.tsx` — route toevoegen
- `src/pages/app/SettingsPage.tsx` — navigatie-item "Online reserveren"

**Niet aangeraakt**
- `src/services/publicBooking.ts` — al gedeeld met AI Voice Agent en publieke API
- Edge functions, RLS, DB schema (alle vereiste velden bestaan al)

## Dependency
- `qrcode.react` reeds geïnstalleerd

## Guardrails toegepast
- **Geen aparte widget-logica** — widget gebruikt dezelfde `getAvailability` en `createPublicReservation` services als interne flow, AI Voice en publieke API
- **Zelfde validatie** — `guestSchema` (zod) blijft de single source of truth in de widget
- **Mobiel** — bestaande widget is al touch-first; instellingen-pagina krijgt mobiele preview-tab; embed-snippet is responsive
- **Veiligheid** — hex-color en URL-param validatie op de widget; geen DOM-injectie van user content