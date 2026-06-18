# Fix: leesbaarheid USP-cards bij hover/selectie

## Probleem
De cards in `SolutionGrid` en `WhyTableWiseSection` (klasse `.usp-card` in `src/index.css`) gebruiken een `::before`-pseudo met `inset: -1px`, een navy→goud gradient en `z-index: -1`. Bij hover wordt `transform: translateY(-4px)` toegepast op de card. `transform` creëert een nieuwe stacking context, waardoor de `z-index: -1` van `::before` niet meer "achter de card" valt maar binnen de card-stacking context — wél boven de eigen achtergrond, maar onder de tekst. In de praktijk laat dit de gradient als gekleurde overlay achter de tekst zien (donkergoud + navy), waardoor grijze/zwarte body-tekst onleesbaar wordt.

Dit raakt alle 6 cards in beide secties. Mobiel (touch) houdt `:hover` actief na tap, dus ook na selectie blijft de tekst onleesbaar.

## Oplossing
Vervang de full-bleed gradient-overlay door een echte gradient-**rand** rondom de card, zonder de inhoud te bedekken. De cardachtergrond blijft `hsl(var(--card))` en tekstkleuren wijzigen niet — leesbaarheid is identiek aan de niet-hover staat.

### Wijziging in `src/index.css` (`.usp-card`)
- `.usp-card`: voeg `isolation: isolate` en `z-index: 0` toe zodat de pseudo-elementen voorspelbaar stapelen binnen de card.
- `.usp-card::before` (gradient ring): `inset: -1px`, dezelfde navy→goud gradient, maar met `padding: 1px` + CSS-mask techniek zodat alleen de 1px rand zichtbaar is:
  ```css
  background: linear-gradient(135deg, hsl(222 44% 12%), hsl(40 72% 52%));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  padding: 1.5px;
  z-index: 1; /* boven cardachtergrond, onder content */
  ```
- Content (`h3`, `p`, icoonblok) krijgt `position: relative; z-index: 2` via een algemene regel `.usp-card > *`.
- `:hover` blijft `transform: translateY(-4px)` + sterkere shadow; de rand-opacity gaat van 0 naar 1.

### Niet aanraken
- Geen wijzigingen aan `PainPointsSection` (gebruikt `bg-card` direct, geen gradient-overlay — daar is geen leesbaarheidsprobleem).
- Geen wijzigingen aan tekst, layout of kleurtokens.
- Geen JSX-aanpassingen in `SolutionGrid.tsx` of `WhyTableWiseSection.tsx` nodig.

## Verificatie
- Visueel checken via `browser--screenshot` op desktop: hover over 1e card → goudkleurige rand, witte cardachtergrond, donkere tekst leesbaar.
- Mobiele viewport: tap simuleren — tekst blijft leesbaar.
- Beide secties (`#functies` SolutionGrid en `WhyTableWiseSection`) controleren.
