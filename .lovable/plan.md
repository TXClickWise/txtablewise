## Probleem
De Weer-sheet toont nu losse cijfers zonder labels: in de 24-uur strip zijn `62%` en `26` raadsels (regenkans vs. wind), en in de 7-daagse lijst zweven kolommen vrij rond zonder uitlijning of headers. De wind-informatie is bovendien niet als zodanig herkenbaar — alleen een cryptische "Wind: krachtig vandaag."-zin onderaan.

## Wat ik herontwerp (alleen `WeatherPill.tsx` Sheet — niet de pill-knop zelf)

### 1. 24-uur sectie → vertical strip met expliciete iconen per metriek
Vervang de zes kolomkaartjes door één compacte rij met **5 vaste rijen** boven elkaar, links de iconen, daarnaast horizontaal scrollende cellen per uur die *op één raster* uitlijnen:

```
            21u   22u   23u   00u   01u   02u   ...
☁/☀         🌥    ☀    🌤    🌤    🌤    🌤
🌡 temp     16°   17°   16°   16°   16°   16°
☂ regen     62%   73%   59%   31%    —    —
💨 wind     ↘26   ↘18   ↘21   ↗22   ↗23   ↗21
```

- Iconen-kolom is sticky links (vaste 44px) zodat tijdens scroll altijd duidelijk is welke metriek je leest.
- Wind toont **pijl + km/u** (pijl wijst in windrichting, kleine `text-[10px]` afkorting NO/ZW eronder bij ≥20 km/u).
- Regenrij verbergt cellen <20% (toont em-dash) om rust te bewaren.
- Strip-cellen 44px breed → 24 uur past in horizontal scroll zonder afgehakte cijfers.

### 2. 7-dagen sectie → echte tabel met headers
Vervang flex-rijen door een CSS-grid met **5 kolommen** en een sticky header-rij:

```
Dag        Weer    Min / Max    Regen   Wind
Vri 12     🌦      12° / 17°    0.6mm   ↘32 NO
Zat 13     ☁       14° / 16°    —       39 NO
Zon 14     🌦      13° / 15°    —       ↘37 NO
...
```

- Grid `grid-cols-[5rem_2.5rem_1fr_4rem_5rem]`, header-rij in `text-muted-foreground text-[11px] uppercase tracking-wide`.
- Regenkolom toont `—` i.p.v. niets bij <0.5mm (consistent uitlijnen).
- Windkolom: pijl + km/u + kompasrichting bij ≥15 km/u, anders em-dash. Tekstkleur muted, rood-tinted bij ≥50 km/u (zelfde drempel als `storm_warning`).
- Eerste dag krijgt `bg-muted/30` band als subtiele "vandaag" markering.

### 3. Wind-context blok
Vervang de losse "Wind: krachtig vandaag."-zin door een klein info-blok onder de tabel:

```
💨 Wind vandaag
   Krachtig (tot 32 km/u uit het noordoosten)
```

- Combineert `windLabel()` + max km/u + `degToCompass()` → volledig leesbare zin in plaats van losse termen.
- Wordt verborgen als geen wind-data beschikbaar is.

### 4. Polish
- Voeg subtiele kolom-scheidingslijnen toe (`divide-y`) in 7-dagen tabel zodat rijen leesbaar zijn op tablet.
- Verhoog rij-hoogte naar `h-10` voor touch.
- Houd kleuren binnen design tokens (`text-muted-foreground`, `text-primary`, geen hardcoded HSL).
- Bron-regel onderaan blijft, maar krijgt `mt-4 pt-3 border-t` voor visuele scheiding.

## Wat blijft ongewijzigd
- De pill-knop zelf (compacte trigger in header) — alleen de Sheet-inhoud verandert.
- Datalaag, edge functions, service helpers. Alleen presentatie in `src/components/weather/WeatherPill.tsx`.
- AdvisoryStrip en alle andere componenten.

## Files te wijzigen
- `src/components/weather/WeatherPill.tsx` — alleen de Sheet-body herstructureren.
