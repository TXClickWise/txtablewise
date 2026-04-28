## Doel

`/app/reserveringen` upgraden van een lijst-met-filters naar een volwaardige reserveringscockpit met meerdere weergaves, sterkere filters, complete snelle acties en een uitgebreid detailpaneel. Alle bestaande functionaliteit (services, statussen, dialogs, mutaties) blijft intact en wordt hergebruikt.

## Wat er nu staat

- `ReservationsPage.tsx` — alleen lijstweergave per dag, status-chips + 5 signaal-chips, zoek, kaarten via `ReservationCard`.
- `AgendaPage.tsx` — bestaande tafelgrid (tafels × tijdslots) op `/app/agenda`. Wordt geïntegreerd als view.
- `FloorModePage.tsx` / `FloorPlanPage.tsx` — bestaande tablet-floor en plattegrond. Worden niet vervangen, alleen via tabs/links bereikbaar gemaakt.
- `ReservationCard` — heeft al: bekijken, aangekomen, voltooid, no-show, annuleer.
- `ReservationDetailDialog` — heeft al: gast, datum/tijd/personen edit, status-acties, no-show, pre-orders, aftercare, POS, large-group goedkeuring.

## Wat we toevoegen

### 1. View-switcher op `/app/reserveringen`

Eén pagina met segmented control bovenaan: **Dag · Week · Lijst · Tafelgrid · Floor**.

```text
Dag        → tijdlijn vandaag/gekozen dag, gegroepeerd per tijdvak (ochtend/lunch/diner/late)
Week       → 7 kolommen × dagen, compacte kaart per reservering, klik = detail
Lijst      → huidige lijst (default voor mobiel)
Tafelgrid  → embed AgendaPage-grid (tafels × tijd) — bestaande component hergebruiken
Floor      → link/redirect naar /app/floor (Floor Mode is volwaardige tablet-route)
```

State (view, datum, filters) in URL search params zodat refresh + delen werkt.

### 2. KPI-strip (3-seconden-eis)

Direct onder de header, 4 compacte kaarten:
- **Gasten vandaag** — som `party_size` op gekozen dag
- **Aandacht nodig** — pending + manual_approval + reconfirmation_status='requested' + grote groep open
- **Tafels vrij nu** — count tafels zonder lopende reservering op huidig tijdslot
- **No-show risico** — count met `no_show_risk` in ('medium','high')

Klik op een kaart = filter activeren.

### 3. Uitgebreide filterbar

Bestaand uitbreiden, alles in één collapsible "Filters"-balk:

| Filter | Bron |
|---|---|
| Datum | bestaande date-popover |
| Tijdvak | nieuw: ochtend/lunch/middag/diner/late + custom range |
| Status | bestaande chips |
| Bron (channel) | nieuw multi-select: online, walk_in, phone, ai_voice, manual, etc. |
| Personen | nieuw range slider (min–max) |
| Allergieën | bestaande signal-chip |
| No-show risico | nieuw: `no_show_risk` low/medium/high |
| Grote groepen | bestaande chip (≥ `large_group_threshold`) |
| Walk-ins | bestaande chip |
| Wachtlijst | nieuw: toon dag-wachtlijst inline (read-only summary, link naar `/app/wachtlijst`) |

Actieve filters tonen als verwijderbare badges. "Wis filters" blijft.

### 4. Snelle acties per rij

`ReservationCard` houden, ontbrekende acties toevoegen via een **kebab-menu** (`DropdownMenu`) rechts van de bestaande knoppen:

- ✓ Bekijken (bestaat)
- ✓ Aangekomen / Voltooid (bestaan)
- ✓ Annuleren / No-show (bestaan)
- ➕ **Wijzigen** — opent detailpaneel direct in edit-modus
- ➕ **Verplaatsen** — kleine sheet: nieuwe datum + tijd, gebruikt `resService.update`
- ➕ **Tafel toewijzen** — sheet met vrije tafels op tijdslot, mutatie op `reservation_tables`
- ➕ **Gastprofiel openen** — link naar `/app/gasten?focus=<guest_id>`
- ➕ **Bericht sturen** — schiet `integration_events` event af (`guest_message_requested`) zodat ClickWise het oppakt; toont "verzoek verzonden" toast

### 5. Detailpaneel als zijpaneel (Sheet)

Nieuwe component `ReservationDetailSheet` naast bestaande `ReservationDetailDialog`. Sheet komt rechts open (desktop) en als bottom-sheet (mobiel). Bevat dezelfde secties + 3 nieuwe blokken:

```text
Header  : status, channel, bevestigingscode, gast-naam
Tabs    : Overzicht · Gast · Activiteit · Integraties
  Overzicht   = huidige inhoud Detail Dialog (gast, datum/tijd, personen, notities, status-acties, no-show, pre-orders, aftercare, POS, large-group)
  Gast        = uitgebreid gastprofiel (visit_count, no_show_count, tags, allergieën, hospitality_notes) + link naar volledig profiel
  Activiteit  = no-show historie (`reservation_status_history`) + reminders (`reservation_reminders`) tijdlijn
  Integraties = laatste AI-call (`agent_call_logs` matched on reservation_id) + laatste 5 `integration_logs` voor reservation_id (link naar /app/integraties/logs)
```

`ReservationDetailDialog` blijft bestaan voor backwards compat (wordt in het Sheet hergebruikt voor de Overzicht-tab — same content, andere chrome).

### 6. Mobiel

- Sheet wordt bottom-sheet < md.
- View-switcher wordt dropdown < md (alleen Lijst/Dag/Tafelgrid relevant op klein scherm).
- Filterbar in Drawer met "Filters (n)" knop.
- `ReservationCard` is al touch-friendly; kebab-menu houdt rij compact.

## Bestanden

**Nieuw**
- `src/components/reservations/ReservationViewSwitcher.tsx` — segmented control
- `src/components/reservations/ReservationKpiStrip.tsx` — 4 kaartjes, klikbaar
- `src/components/reservations/ReservationFilterBar.tsx` — uitgebreide filters + actieve-badges
- `src/components/reservations/views/DayView.tsx` — gegroepeerd per tijdvak
- `src/components/reservations/views/WeekView.tsx` — 7-koloms grid
- `src/components/reservations/views/TableGridView.tsx` — wrapper rond bestaande agenda-tafelgrid (geëxtraheerd uit `AgendaPage`)
- `src/components/reservations/ReservationDetailSheet.tsx` — Sheet met 4 tabs, hergebruikt Detail Dialog secties
- `src/components/reservations/QuickActionsMenu.tsx` — kebab-dropdown (verplaatsen/tafel/profiel/bericht/wijzigen)
- `src/components/reservations/MoveReservationSheet.tsx` — datum+tijd snel verplaatsen
- `src/components/reservations/AssignTableSheet.tsx` — tafel toewijzen aan reservering
- `src/services/reservationMessages.ts` — dunne helper rond `integration_events` insert voor "Bericht sturen"

**Aangepast**
- `src/pages/app/ReservationsPage.tsx` — wordt orchestrator: KPI-strip + view-switcher + filterbar + actieve view + detail-sheet. URL-state met `useSearchParams`.
- `src/components/reservations/ReservationCard.tsx` — voeg `<QuickActionsMenu>` toe naast bestaande knoppen, geen verlies van huidige acties.
- `src/pages/app/AgendaPage.tsx` — blijft bestaan (oude route), maar tafelgrid-rendering wordt geëxtraheerd naar `TableGridView` zodat beide pagina's dezelfde component delen. Geen breaking change.

**Niet aangeraakt**
- `services/reservations.ts`, statussen, RLS, dialogs, FloorMode/FloorPlan, walk-in, wachtlijst-pagina's.

## Data-aanpak

- Bestaande dag-query uitbreiden met `no_show_risk`, `reconfirmation_status`, `guests.visit_count, no_show_count, tags, hospitality_notes`.
- Voor WeekView: één query per week-range (`reservation_date BETWEEN`), zelfde shape als CardReservation.
- Voor "Tafels vrij nu" KPI: hergebruik `tables` query + dag-query om bezetting per tijdslot te bepalen (client-side, geen extra round-trip).
- Activiteit-tab: queries op `reservation_status_history` en `reservation_reminders` per `reservation_id`.
- Integraties-tab: query `integration_logs` `where reservation_id = ?` limit 5 + `agent_call_logs` `where reservation_id = ?` limit 1.

## Guardrails (gerespecteerd)

- Geen reserverings­logica vervangen — alle mutaties via bestaande `services/reservations.ts`.
- Geen nieuwe statussen — gebruikt alleen bestaande enum-waardes.
- Mobiel: views & sheet zijn responsive; KPI-strip wraps; filterbar in drawer < md.
- Geen breaking changes voor `/app/agenda`, `/app/floor`, `/app/tafelplan`, `ReservationDetailDialog`.

## Geen migraties nodig

Alle vereiste velden staan al in de DB (`no_show_risk`, `reconfirmation_status`, `external_reference`, `integration_logs`, `agent_call_logs`, `reservation_status_history`, `reservation_reminders`).
