## Probleem

De agenda (`/app/agenda`) opent `ReservationDetailDialog`, niet de nieuwere `ReservationDetailSheet`. In de Dialog staat alleen de **QuickBar** (3 knoppen: Aan tafel / No-show / Annuleer) — de **Status­wisselaar met alle 7 status­pillen** en de **inline Tafel-/tijd-editor** zitten daar nooit in gemount. Vandaar dat je ze niet ziet en niet snel van tafel kunt wisselen.

Daarnaast staan datum-/tijd-/persoons­velden nu *onderaan* de Dialog, achter een grote scroll. Dat schendt de regel "snelle bewerk-acties altijd bovenaan".

## Aanpak

Eén bestand wijzigen: `src/components/ReservationDetailDialog.tsx`. Geen logica- of backend-wijzigingen, alleen UI/compositie.

### 1. Bovenin het Dialog (direct onder de badges) drie compacte blokken in deze volgorde

1. **Tafel & tijd** — toont huidige tafel, starttijd, eindtijd en duur als één regel, met "Wijzig"-knop die de bestaande `ReservationSlotEditor` inline uitklapt (zelfde component als de Sheet gebruikt).
2. **Status van reservering** — bovenin de primaire `ReservationStatusQuickBar` (groot, layout="grid", 1 tap voor de meest gebruikte stappen) en daaronder, gescheiden met een dunne lijn, de `ReservationStatusSwitcher` met alle 7 status­pillen (incl. terugzetten-bevestiging + reden, audit-trail blijft intact).
3. Bestaande gast­blok blijft direct daaronder.

### 2. De oude losse Datum/Tijd/Personen-velden onderaan verwijderen

Die zijn nu redundant met `ReservationSlotEditor`. Het `internal_notes` / `special_requests` veld + "Wijzigingen opslaan"-knop blijven onderaan voor notities (die heeft de SlotEditor niet). De save-functie wordt versmald: alleen `internal_notes`, `special_requests`, `party_size` (party_size verhuist naar een compacte regel boven de notities, want dat hoort logisch bij de bewerk-sectie).

### 3. Niets aan de andere kant raken

- `ReservationDetailSheet` heeft de juiste opbouw al; ongewijzigd.
- `ReservationStatusSwitcher`, `ReservationSlotEditor`, `ReservationStatusQuickBar` ongewijzigd.
- Agenda popover (klein menu in screenshot 2) blijft zoals die is — die is bewust beknopt.

## Verificatie

- /app/agenda → klik reservering → Dialog opent → bovenaan staan **Tafel & tijd** (met Wijzig-knop die SlotEditor toont) en **Status van reservering** met alle 7 pillen.
- Wissel "Aan tafel" → "Bevestigd" via pil: bevestigingsdialog met redenveld verschijnt.
- Wijzig tafel via SlotEditor: opslaan werkt, toast verschijnt, agenda ververst.
- Geen scrollen nodig om status of tafel te wijzigen.

## Bestanden

- `src/components/ReservationDetailDialog.tsx` (compositie + imports)
