# Probleem

In de tijdlijn op /app/agenda kan een reservering met de muis naar een andere tafel/tijd worden gesleept, maar op telefoon en tablet werkt dat niet met de vinger. Reden: de scroll-container heeft `touch-action: pan-x pan-y`, en het reserveringsblokje vangt `pointerdown` af zonder dat te onderdrukken. Zodra de vinger beweegt vat de browser het op als scrollen → drag krijgt `pointercancel` en wordt nooit een echte drag.

# Oplossing — long-press initiated drag op touch

Bekend en gastvrij patroon voor tablet-first apps: bij touch start een drag pas na ±250 ms ingedrukt houden, met haptische feedback. Bij muis (zoals nu) direct slepen na 8 px beweging.

## Gedrag

- **Muis / pen**: ongewijzigd — direct slepen na ~8 px (huidige drempel).
- **Touch (telefoon/tablet)**:
  1. Vinger op een reserveringsblokje → 250 ms timer start, blok krijgt subtiele "hold" highlight (ring + lichte schaal).
  2. Beweegt de vinger > 8 px vóór de timer afloopt → timer cancelt, gewone tijdlijn-scroll/pinch werkt zoals voorheen.
  3. Tikt de gebruiker kort (loslaten < 250 ms zonder bewegen) → opent de detail-sheet (huidige onClick), niets verandert.
  4. Timer haalt 250 ms → `navigator.vibrate?.(15)`, drag-mode actief, `touch-action: none` wordt op `<html>` gezet zolang de drag loopt zodat de browser niet meer scrollt, en de bestaande pointermove-flow neemt het over (snapping op kwartier, conflict-check, drop op andere tafel).
  5. Loslaten → bestaande save-flow (manage_reservation) en toast.
  6. Annuleren door de vinger ver buiten de tijdlijn te bewegen of een tweede vinger erbij (pinch) → drag cancel, terug naar normale scroll.

## Subtiele UI hints (alleen tijdlijn-mobiel)

- Tip-tekst bovenaan tijdlijn aanvullen: "Houd een reservering even ingedrukt om naar een andere tafel of tijd te slepen."
- Tijdens hold-fase: blok krijgt `ring-2 ring-primary/60` en lichte `scale-[1.02]`.
- Tijdens drag: bestaande "ghost"/preview blijft werken.

# Bestanden

Alleen `src/pages/app/AgendaPage.tsx`:

1. **Nieuwe state** `holdId: string | null` + `holdTimerRef` + `holdStartRef`.
2. **`onBlockPointerDown` aanpassen**: bij `pointerType === "touch"` géén directe drag-init meer; in plaats daarvan timer (250 ms) starten, beginpositie onthouden. Bij mouse/pen: huidige logica behouden.
3. **Document-level `pointermove` luisteraar (touch hold-fase)**: als vinger > 8 px beweegt vóór timer-afloop → timer cancelen, hold-state legen. Als timer afloopt → `setDrag(...)` zoals nu, `document.documentElement.style.touchAction = "none"`, vibrate.
4. **`pointerup`/`pointercancel`**: timer altijd opruimen, `touchAction` van `<html>` herstellen.
5. **Tap = open detail**: in de bestaande `onClick` van de inner-button blijft `justDraggedRef` werken; voor touch tellen we het pas als drag wanneer de timer is afgelopen, dus korte tap opent gewoon de sheet.
6. **Tip-tekst** boven de tijdlijn aanvullen met de hold-zin.

Geen backend-, edge-function- of datamodel-wijziging.

# Out-of-scope

- Drag-and-drop op de Plattegrond/Floor Mode (apart verhaal).
- Resize van blokjes via drag (duur wijzigen) — blijft via slot-editor in detail-sheet.
- Verzending van herbevestigingsmail bij verplaatsing — afzonderlijke discussie die nog openstaat.
