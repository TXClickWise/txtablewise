## Doel

Walk-in plaatsen via "klik op vrije tafel" moet écht in 3-5 seconden kunnen: alleen aantal personen verplicht, en als je tóch een naam of telefoon wilt invullen moet dat direct zichtbaar zijn (geen "Meer opties" eerst openen).

## Wijzigingen

### 1. Anonieme walk-ins toestaan — `src/services/walkIn.ts`

Op dit moment blokkeert de service een walk-in zonder e-mail én telefoon met de melding *"Voeg een telefoonnummer of e-mailadres toe"*. Dat is precies wat de gebruiker niet wil.

- Validatie verwijderen: aantal personen blijft het enige verplichte veld (al gedekt door Zod min 1).
- Wanneer geen e-mail én geen telefoon: synthetisch e-mailadres genereren (`walkin-{timestamp}@walkin.local`) zodat `book_reservation` blij blijft. Dit patroon gebruikt de oude `WalkInDialog` al, dus geen backend-wijziging nodig.
- Wanneer geen voornaam: blijft fallback `"Walk-in"` (bestaat al).

### 2. Snelle invoer voor naam & telefoon — `src/components/walk-in/WalkInQuickSheet.tsx`

Naam en Telefoon zitten nu verstopt in `<Collapsible open={moreOpen}>`. Die verplaatsen we naar een altijd-zichtbare compacte sectie boven de "Plaats nu"-knop, zodat één tik volstaat om te beginnen typen.

- Nieuwe sectie **"Gast (optioneel)"** direct ná de tafelaanbeveling, vóór "Meer opties":
  - Twee velden naast elkaar (op mobiel onder elkaar): `Naam (optioneel)` en `Telefoon (optioneel)`.
  - `h-12` inputs, `inputMode="tel"` op telefoon, `autoComplete="off"`, geen labels boven de velden — alleen placeholders ("Naam", "Telefoon") + kleine helptekst *"Niet nodig voor snelle plaatsing"*.
- "Meer opties" houdt enkel nog: **Verwachte duur** en **Notitie**. Naam/telefoon eruit halen.
- Header description aanpassen: *"Geen gastgegevens nodig — alleen aantal personen volstaat."*
- CTA-knop "Plaats nu" blijft enabled zodra een tafel gekozen is, ongeacht naam/telefoon.

## QA

1. Open Walk-in sheet → kies 2p → tafel auto-geselecteerd → "Plaats nu" → reservering verschijnt zonder ooit een veld te hebben aangeraakt.
2. Open sheet → tik direct op het zichtbare veld "Naam" of "Telefoon" → typen werkt zonder eerst ergens op te klikken.
3. "Meer opties" bevat nu enkel duur + notitie.
4. Bestaande prefill-flow (vanaf Floor Mode/Tafelplan klik op vrije tafel) blijft werken: `prefill.firstName` vult het altijd-zichtbare veld in.

## Niet aanraken

- `book_reservation` edge function (synthetisch e-mail volstaat).
- Pacing/conflict-logica.
- Layout van overige walk-in entrypoints (AI Quick Seat, WalkInDialog).