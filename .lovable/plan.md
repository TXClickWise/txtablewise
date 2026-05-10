# Sprint 6 — Polish

Vier kleine items uit de audit, geen nieuwe features.

## 1. `?lang=` deeplink op `/r/:slug/manage` (#11)
- Vitest test toevoegen die `detectLocale` aanroept met een gesimuleerde `?lang=de|fr|en|nl` en bevestigt dat de juiste locale gekozen wordt, ook als de browser-locale anders is.
- Eén round-trip rendertest van `GuestManageReservation` met `?lang=fr` om te bevestigen dat i18n-strings uit `fr/manage.json` getoond worden.
- Bestand: `src/test/i18n-deeplink.test.ts` (nieuw).

## 2. Uitschrijf/cancel-reden copy in DE & FR (#12)
- Bij controle blijken `cancelDescription` en `cancelReasonPlaceholder` al aanwezig in alle 4 locales (NL/EN/DE/FR). 
- Wel ontbreekt nog een expliciete `reason`-veld-label voor de unsubscribe-flow. Toevoegen aan `unsubscribe`-blok in alle 4 `common.json`'s: `reasonLabel` ("Reden (optioneel)") + `reasonPlaceholder`. UI aanpassen in `src/pages/Unsubscribe.tsx` om dit veld te tonen indien gewenst — als de pagina geen reden-veld heeft, alleen vertalingen toevoegen voor consistentie en geen UI-wijziging.

## 3. Console warnings opruimen (#27)
Twee React Router v7 future-flag warnings actief. Oplossing: `BrowserRouter` opt-in voor toekomstige flags.
- `src/App.tsx`: `<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>`.
- Daarna preview verifiëren — geen router-warnings meer.

## 4. "Binnenkort"-knoppen opruimen (#28)
- **`POSIntegrationPage.tsx`** regels 276–278: drie disabled "Binnenkort"-kaarten (CSV-import, Make/Zapier/n8n, Custom API). Vervangen door één informatieve `SectionCard` met tekst: "Meer koppelingen volgen — laat het ons weten welke je nodig hebt", inclusief mailto/feedback-link. Geen valse knoppen meer.
- **`PreOrderDrinksPage.tsx`** regel 346: switch "Betaling vereist (voorbereid)" met copy "Wordt nog niet echt afgerekend". Aanpassen naar duidelijkere copy: "Markeert dit item als betaald-vereist in het datamodel. Aanbetalingen worden later geactiveerd via Aanbetalingen-module." — switch blijft functioneel (vlag wordt opgeslagen, conform "payment-ready" memory).

## Verificatie
- `bunx vitest run` voor nieuwe test.
- Preview-check: `/app` → geen router-warnings in console; `/app/koppelingen/pos` → geen "Binnenkort"-knoppen meer; `/app/pre-orders` → nieuwe copy zichtbaar.

## Niet in deze sprint
- #13 Aanbetalingen UI (apart traject).
- #20 Wachtlijst-conversie meting (apart traject).
