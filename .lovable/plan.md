## Antwoord op je vraag: welke statussen zijn er nu?

Uit `src/components/StatusBadge.tsx` en de detail sheet:

**Reserveringscyclus** (de "normale" route)
- `hold` — Tijdelijk vast (door systeem, bv. tijdens checkout)
- `pending` — Verwacht (nog niet bevestigd)
- `confirmed` — Bevestigd
- `seated` — Aan tafel
- `completed` — Vertrokken
- `cancelled` — Geannuleerd
- `no_show` — No-show

**Aanvraagworkflow** (grote groepen / aanbetaling)
- `request_received` — Aanvraag ontvangen
- `awaiting_approval` — Wacht op goedkeuring
- `awaiting_deposit` — Wacht op aanbetaling
- `approved` — Goedgekeurd
- `declined` — Afgewezen

Wat nu mis is: in de detail sheet zie je alleen forward-acties (Afgerond / Annuleer). Een verkeerde "Aan tafel" terugzetten kan dus niet, en in de tijdlijn kun je niets verslepen.

## Plan

### Stap 0 — Toetsenbord-fix uit vorige plan
De 4 stappen die we al hadden afgesproken (viewport meta + `useKeyboardInset` hook + sheet padding + auto-scroll bij focus). Wordt eerst doorgevoerd voordat de nieuwe sheet-uitbreidingen erop landen.

### Stap 1 — Drag-and-drop in de Tijdlijn (Agenda)
- In `src/pages/app/AgendaPage.tsx` (tijdlijn-view): elke reserveringskaart wordt draggable met **dnd-kit** (al een Lovable-conventie volgens de touch-primitives memory; `dnd-kit/core` toevoegen indien nog niet aanwezig).
- Twee soorten drops:
  1. **Andere tafelrij** → tafel wijzigen
  2. **Horizontaal binnen dezelfde rij** → tijd wijzigen, in stappen van 15 minuten (snap)
  3. Combinatie (diagonaal slepen) = beide tegelijk
- Tijdens drag: ghost-kaart + highlight van de drop-zone (vrij = groen, conflict = rood/disabled).
- Voor conflicten: bestaande `tableRecommendation`-helpers hergebruiken om overlap en capaciteit te checken. Bij conflict → geen drop toegestaan + korte toast.
- Touch-ondersteuning aan (PointerSensor met activation constraint 8px / 150ms, zodat gewone taps niet per ongeluk slepen op tablet).
- Backend: één `updateReservationSlot({ id, table_ids?, start_time?, end_time? })` in `src/services/reservations.ts` (of de bestaande `reservationService`-facade) die: `reservations.start_time` + `end_time` (duur behouden) en `reservation_tables` rijen vervangt, en een regel in `reservation_status_history` schrijft met `reason = "Verplaatst via tijdlijn"`.

Niet voor lijst- en plattegrond-view in deze stap (alleen tijdlijn), tenzij je dat ook wilt — zie open vraag onderaan.

### Stap 2 — Inline tafel + tijd aanpassen in de detail sheet
In `src/components/reservations/ReservationDetailSheet.tsx`, een nieuw blokje "Tafel & tijd" net onder de gastgegevens:

```
┌──────────────────────────────────────────┐
│ Tafel & tijd                  [Wijzig]   │
│ Tafel 50 · 14:00 – 15:30 (90 min)        │
└──────────────────────────────────────────┘
```

Op "Wijzig" klapt het blok open met:
- **Tafel-selector**: multi-select van actieve tafels, gegroepeerd per zone, met live conflict-check (zelfde helper als drag-drop).
- **Tijd**: datum + starttijd + duur (preset-knoppen 60/90/120 min + custom).
- Onderaan: **Opslaan** + **Annuleren**. Bij conflict → inline waarschuwing, geen save.
- Opslaan roept dezelfde `updateReservationSlot` aan als de drag-drop → één pad, één audit-regel.

### Stap 3 — Vrije statuswissel (incl. terugdraaien)
Nieuwe component `ReservationStatusSwitcher` boven het huidige "Status van reservering"-blok.

UI:
- Compacte horizontale rij met de 7 lifecycle-statussen als pillen (`pending`, `confirmed`, `seated`, `completed`, `no_show`, `cancelled`, `hold`).
- Huidige status is duidelijk gemarkeerd, alle andere zijn aantikbaar.
- Aanvraag-statussen (`request_received`/`awaiting_*`/`approved`/`declined`) tonen we alleen als de reservering daarin zit; die zijn workflow-gedreven en niet vrij wisselbaar.
- Voor een **gevoelige back-step** (seated→confirmed, completed→seated, no_show→confirmed, cancelled→confirmed) tonen we een bevestigingsdialog: "Status van Jan Jansen terugzetten van 'Aan tafel' naar 'Bevestigd'?" + verplicht reden-veldje (kort, bv. "per ongeluk gewijzigd").
- Voor forward-steps (pending→confirmed, confirmed→seated, etc.) direct toepassen zonder dialog — dat is de bestaande flow.
- Elke wijziging schrijft naar `reservation_status_history` met `changed_by_type='staff'`, `old_status`, `new_status`, `reason`.
- De huidige knoppen "Afgerond" en "Annuleer" blijven staan als snelle shortcuts.

Geen schema-wijziging nodig — `reservation_status_history` bestaat al; `reservations.status` is `text`, dus alle waarden zijn toegestaan.

### Stap 4 — Verificatie
- Tijdlijn op tablet (1024×768): kaart verslepen naar tafel 41 → reservering verhuist, history-entry zichtbaar in detail sheet.
- Snap-test: kaart 12 minuten naar rechts → snapt naar 15-min boundary.
- Conflict-test: drop op tafel met overlappende reservering → drop geweigerd + toast.
- Detail sheet → "Wijzig" → tafel + tijd aanpassen → opslaan → tijdlijn refresht.
- Status-switcher: seated → confirmed met reden "test" → history-entry + badge update.
- Toetsenbord-fix: AI Quick Seat op 360×619 mobile → input + bevestig-knop zichtbaar boven toetsenbord.

### Bestanden die wijzigen
- `index.html`, `src/hooks/use-keyboard-inset.ts` (nieuw), `src/components/ui/sheet.tsx` — Stap 0
- `src/pages/app/AgendaPage.tsx` — drag-drop in tijdlijn
- `src/services/reservations.ts` — `updateReservationSlot` helper
- `src/components/reservations/ReservationDetailSheet.tsx` — Tafel & tijd-blok + StatusSwitcher embedden
- `src/components/reservations/ReservationStatusSwitcher.tsx` (nieuw)
- `src/components/reservations/ReservationSlotEditor.tsx` (nieuw) — herbruikbaar voor inline edit en evt. later voor de Lijst-view

### Open vraag
Wil je drag-drop óók in de **Plattegrond**-view (reservering naar tafel slepen op de floorplan), of voor nu alleen in de Tijdlijn? Plattegrond kost ~1 extra stap; de inline-editor in de detail sheet vangt het use case sowieso af.
