
## Probleem
- "26" en "32 km/u" zegt operators niets — ze willen weten of het rustig of stormachtig is.
- Windrichting (NO/ZW) is nu een kleine afkorting náást een pijl en wordt over het hoofd gezien; bij sommige rijen ontbreekt 'ie zelfs visueel.
- Er is geen visuele urgentie: een briesje en een storm zien er bijna hetzelfde uit.

## Oplossing: Beaufort-schaal + officiële KNMI-windkracht-kleuren

### 1. Nieuwe helper `beaufort(kmh)` in `src/services/weather.ts`
Officiële Beaufort-schaal (km/u → Bft → NL benaming) volgens KNMI:

| Bft | km/u      | Naam NL          | Kleur (hint)         |
|-----|-----------|------------------|----------------------|
| 0   | <1        | Windstil         | muted                |
| 1   | 1–5       | Zwakke wind      | muted                |
| 2   | 6–11      | Zwakke wind      | muted                |
| 3   | 12–19     | Matige wind      | sky-500              |
| 4   | 20–28     | Matige wind      | sky-600              |
| 5   | 29–38     | Vrij krachtige wind | amber-500         |
| 6   | 39–49     | Krachtige wind   | amber-600            |
| 7   | 50–61     | Harde wind       | orange-600           |
| 8   | 62–74     | Stormachtig      | red-600              |
| 9   | 75–88     | Storm            | red-700              |
| 10  | 89–102    | Zware storm      | red-800              |
| 11  | 103–117   | Zeer zware storm | purple-700           |
| 12  | ≥118      | Orkaan           | purple-900           |

Helper geeft `{ bft, name, shortName, colorClass, bgClass }` terug — kleuren via design-tokens (mapping naar bestaande semantische tokens: `text-muted-foreground`, `text-primary`, `text-amber-600`, `text-orange-600`, `text-destructive`, `text-purple-700` — gebruikt Tailwind palette die in dit project beschikbaar is; geen hardcoded hex).

### 2. Windrichting prominenter
- Vervang lucide `Navigation`-pijl door grotere, duidelijke pijl (`Navigation` h-4 w-4) met `text-foreground` i.p.v. muted, zodat 'ie opvalt.
- Toon de afkorting (N/NO/O/ZO/Z/ZW/W/NW) altijd náást de pijl in zelfde regel, niet als losse mini-tekst eronder.

### 3. Aanpassingen `WeatherPill.tsx`

**Pill-knop (header):**
```
🌥 16°  ↘ ZW · Krachtig
```
- Toon Beaufort-naam i.p.v. km/u-getal.
- Pijl + kompasafkorting altijd zichtbaar als wind ≥ Bft 3.
- Kleur van wind-chip volgt Beaufort-kleur.

**24-uur strip — wind-rij:**
- Cel inhoud per uur: pijl + Bft-cijfer in gekleurde badge (bijv. `5` op amber achtergrond), kompas-afkorting eronder.
- Wind-rij krijgt een kleine legenda-link "Beaufort 0–12" als tooltip-trigger.

**7-dagen tabel — wind-kolom:**
- Vervang `↘ 32 NO` door: pijl + kompas + Beaufort-naam (bv. `↘ NO · Krachtig`).
- Kolombreedte vergroot naar `6.5rem` om naam te passen.
- Tekstkleur volgt Beaufort-kleur (muted bij ≤Bft 2, semantic-kleur vanaf Bft 5).

**Wind-context blok onderaan:**
Vervang door duidelijker formulering:
```
💨 Wind vandaag
   Krachtige wind (Bft 6) uit het noordoosten
   Piek 49 km/u rond 15:00
```
- Toon Beaufort-naam + Bft-cijfer + windrichting in woorden.
- Voeg piek-uur toe (uit `hourly` data).
- Kleurband links (4px) in Beaufort-kleur als visuele indicator.

### 4. Geen wijzigingen aan
- Datalaag, edge functions, advisory-logica (drempels in `weather_advise` blijven op km/u — operators zien alleen Beaufort, het systeem rekent intern in km/u).
- Pijl-rotatie-logica (blijft `(deg + 180) % 360`).
- `degToCompass` helper (blijft in gebruik).

## Files
- `src/services/weather.ts` — voeg `beaufort()` helper toe (km/u → Bft + naam + kleurklasse).
- `src/components/weather/WeatherPill.tsx` — pill-knop, 24u wind-rij, 7-daagse wind-kolom, wind-context blok.

## Technische details
- Kleurklassen worden Tailwind utility classes (geen nieuwe CSS tokens), zodat dark mode automatisch werkt via Tailwind's amber/orange/red palettes. Geen hardcoded HSL in components — Tailwind-utility classes zijn toegestaan binnen het projectsysteem (gebruikt door bv. `text-destructive`).
- `beaufort()` is pure: input `number | null`, output object met defaults bij null.
- Pijl-rotatie blijft inline `style={{ transform: ... }}` omdat Tailwind geen arbitrary rotation values uit data ondersteunt.
