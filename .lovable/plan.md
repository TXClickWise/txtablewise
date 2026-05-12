## PWA branding op nieuwe huisstijl brengen

De huidige PWA-iconen en manifest gebruiken een verouderde oranje/saddle-brown branding (`#8B4513`, oranje "TX" met serif op wit). Brengen naar de actuele tokens: **navy `#11192B`** + **warm goud `#D89A2C`**, sans-serif (Plus Jakarta).

### 1. Nieuwe iconen genereren

Drie PNG's via `imagegen--generate_image` (premium, voor scherpe typografie):

- `public/icons/icon-192.png` — 512×512 gerenderd, opgeslagen op 192. Navy `#11192B` achtergrond met afgeronde hoeken (~20% radius), gecentreerde goud `TX` letterlijk in **Plus Jakarta Sans Bold**, subtiele goud-glow.
- `public/icons/icon-512.png` — zelfde ontwerp, 512×512.
- `public/icons/icon-maskable-512.png` — full-bleed navy (geen rounded corners — Android maskeert zelf), `TX` in centrale **80% safe-zone**, iets kleiner zodat hij niet wordt afgeknipt door circle/squircle masks.

### 2. `public/manifest.json` updaten

```json
{
  "theme_color": "#11192B",
  "background_color": "#11192B"
}
```

Rest blijft ongewijzigd (`name`, `start_url: /app`, `display: standalone`, icon-paden).
Effect: splash-screen op iOS/Android start in navy in plaats van wit-flash → naadloze overgang naar app.

### 3. `index.html` updaten

```html
<meta name="theme-color" content="#11192B" />
```

Sync met manifest. `apple-touch-icon` blijft naar `/icons/icon-192.png` wijzen (gebruikt nieuwe asset automatisch).

### Technische notes

- Geen `vite-plugin-pwa`, geen service worker — manifest-only blijft zoals afgesproken in PWA-richtlijn.
- HSL → hex mapping uit `index.css`:
  - `--primary: 222 44% 12%` → `#11192B` (navy)
  - `--accent: 40 72% 52%` → `#D89A2C` (goud)
- Bestaande `InstallPrompt.tsx` werkt automatisch met de nieuwe assets — geen code-wijziging nodig.
- Geen wijziging aan `OG/Twitter` images (aparte concern, niet in scope).

### Out of scope

- Splash-screens voor iOS (aparte set assets — als gewenst, apart oppakken).
- Favicon (`/favicon.ico`) — niet genoemd in deze vraag.
- Logo-component in app-UI.
