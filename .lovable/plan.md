## Plan

1. **PWA-iconen vervangen**
   - Genereer nieuwe `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` en `public/favicon.ico` in de huidige TX TableWise branding.
   - Gebruik de actuele merkkleuren uit `src/index.css`: donker navy als basis en warm goud als accent.

2. **Manifest en browsermetadata nalopen**
   - Controleer `public/manifest.json` en `index.html` op app-naam, short name, theme color, Apple-title en iconverwijzingen.
   - Corrigeer alleen waar nog oude branding of inconsistenties staan.

3. **Offline/PWA fallback bijwerken**
   - Update `public/offline.html`, want die gebruikt nog oude beige/bruine styling.
   - Zet copy en styling om naar TX TableWise met dezelfde navy/goud uitstraling.

4. **Service worker cleanup behouden**
   - Laat de bestaande kill-switch service workers (`/sw.js` en `/service-worker.js`) intact, zodat oude cached PWA-builds blijven worden opgeschoond.
   - Voeg geen nieuwe caching/offline service worker toe om de witte schermen niet opnieuw te veroorzaken.

5. **Controle**
   - Controleer na de wijziging dat manifest/icon-bestanden bestaan, juiste afmetingen hebben en geen oude dominante bruine branding meer bevatten.
   - Geef aan dat bestaande geïnstalleerde PWA’s mogelijk opnieuw geïnstalleerd moeten worden voor pinned icon/name-updates op iOS/Android.