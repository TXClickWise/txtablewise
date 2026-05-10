## Doel

Status van een reservering op de snelst mogelijke manier kunnen aanpassen, met dezelfde knoppenset overal: agenda (dag/tabel-grid), lijst, Floor Mode en tafelplan. Eén tap = één statusovergang, met bevestiging alleen waar nodig (annuleren, no-show).

## Huidige statussen (ter referentie voor de gebruiker)

`hold` · `pending` · `confirmed` · `seated` · `finished` · `completed` · `no_show` · `cancelled`

In de UI tonen we de werkbare set: **Bevestigd → Aan tafel → Klaar/Afgerond → Afgerekend**, plus **No-show** en **Annuleren** als zijacties. `hold` en `pending` zijn meestal automatisch / via large-group flow.

## Onderdeel 1 — Nieuwe component `ReservationStatusQuickBar`

`src/components/reservations/ReservationStatusQuickBar.tsx`

Eén herbruikbare horizontale knoppenstrip met logica op één plek:

- Bevestigen (alleen bij `pending`)
- Aan tafel (`confirmed` / `pending` → `seated`)
- Klaar (`seated` → `finished`) — alleen tonen als finished gebruikt wordt
- Afgerond (`seated`/`finished` → `completed`)
- No-show (`confirmed`/`pending` → `no_show`) — met bevestigingsdialoog
- Annuleren (`pending`/`confirmed`/`seated`/`hold` → `cancelled`) — met bevestigingsdialoog

Props: `reservation`, `size` (`sm` | `md` | `lg` voor floor mode tablet), `layout` (`row` | `grid`), `onChanged` callback. Gebruikt `reservations.markSeated/markCompleted/markNoShow/cancel/changeStatus` uit `src/services/reservations.ts`. Loading-state per knop, toast bij succes/fout, query-invalidatie via `useQueryClient`.

Eindstatussen (`completed`, `cancelled`, `no_show`) → strip toont alleen badge "Afgerond / Geannuleerd / No-show" met optionele "Heropenen"-knop (terug naar `confirmed`).

## Onderdeel 2 — Inbouwen op alle plekken

| Plek | Bestand | Aanpassing |
|---|---|---|
| Reservering-kaart (lijst / vandaag / zoek) | `src/components/reservations/ReservationCard.tsx` | Inline knoppen vervangen door `<ReservationStatusQuickBar size="sm" layout="row" />` |
| Reservering detail-sheet | `src/components/reservations/ReservationDetailSheet.tsx` | `size="md"`, bovenaan onder de header, sticky |
| Reservering detail-dialog (oud) | `src/components/ReservationDetailDialog.tsx` | Idem |
| Agenda — dag/tabel-grid | `src/components/reservations/views/DayView.tsx`, `views/TableGridView.tsx` | In de hover/tap-popover van een blok; tablet-friendly `size="md"` |
| Floor Mode tafelkaart | `src/pages/app/FloorModePage.tsx` | In de tafel-detail sheet (wanneer tafel geopend wordt): `size="lg"`, `layout="grid"`, grote touch-knoppen via `QuickActionButton` |
| Tafelplan (floor plan) | `src/components/floor-plan/FloorPlanEditor.tsx` (of bijbehorend detailpaneel) | Idem als Floor Mode |
| Walk-in detail | `src/components/walk-in/*` | Idem |

`QuickActionsMenu` (kebab) blijft bestaan voor secundaire acties (Verplaatsen, Tafel toewijzen, Bericht sturen, Gastprofiel). Statusovergangen verhuizen volledig naar de `QuickStatusBar`.

## Onderdeel 3 — Tablet/Floor Mode variant

Voor `size="lg"` (Floor Mode + tafelplan):
- Min 56px hoog, gebruik `QuickActionButton` uit `src/components/touch/QuickActionButton.tsx`
- Layout = 2×3 grid op tablet
- Kleurcodering volgens `--status-*` tokens uit `index.css`, consistent met `StatusBadge`
- Sticky bovenaan (StickyActionBar) zodat scrollen niet de knoppen verbergt

## Onderdeel 4 — Bevestigingsdialogen

Hergebruik `ConfirmActionDialog` uit `src/components/touch/ConfirmActionDialog.tsx` voor:
- No-show: "Markeer als no-show? Dit wordt bewaard in de gastgeschiedenis."
- Annuleren: "Reservering annuleren? De tafel komt weer beschikbaar."
- Heropenen (vanuit eindstatus): "Reservering heropenen?"

Geen dialoog voor Aan tafel / Afgerond — die zijn één tap zonder bevestiging (sneller werken).

## Onderdeel 5 — Realtime + invalidation

Na elke statuswijziging:
- `qc.invalidateQueries()` op de relevante keys (`reservations`, `floor-mode-reservations`, `agenda-day`, etc.)
- Toast met gastvrije copy ("Gast staat op 'aangekomen'", "Bezoek afgerond", etc.)
- Geen page reload — alle views updaten via React Query

## Wat er niét verandert

- Geen wijziging in `manage_reservation` edge function of database
- Geen nieuwe statuswaardes
- Bestaande logica in `reservations.ts` blijft het enige toegangspad
- `ReservationCard` blijft visueel hetzelfde, alleen knoppen worden geconsolideerd

## QA na implementatie

- Lijst-kaart: confirmed → tap Aan tafel → status flipt direct, kaart toont nu "Afgerond"-knop
- Floor Mode: tafel met seated reservering → grote knop "Afgerond" → tafel komt vrij in de visualisatie
- No-show: tap → dialog → bevestig → status + toast + gastgeschiedenis
- Eindstatus: knoppen verdwijnen, "Heropenen" beschikbaar
- Tablet 768px+: knoppen blijven 56px+, geen overlap met andere elementen
