## Datumkiezer verbeteren

Twee aanpassingen aan de datumkiezer (popover-kalender) die in de hele app gebruikt wordt op /app/agenda, /app/reserveringen (lijst) en /app/vloer (Floor Mode):

### 1. Puntjes onder dagen met reserveringen
- Per maand die in de popover zichtbaar is, de set unieke `reservation_date`'s ophalen voor het huidige restaurant (alle statussen behalve `cancelled`).
- Die data via `modifiers={{ hasReservations: Date[] }}` en `modifiersClassNames` aan `react-day-picker` doorgeven.
- Stijl: klein bolletje (`bg-primary`) onder het dagnummer via een `::after`-pseudo-element op de cel (semantische token `--primary`), zichtbaar ook op de geselecteerde dag (in primary-foreground kleur voor contrast).

### 2. Auto-sluiten na selectie
- `Popover` wordt controlled gemaakt (`open` / `onOpenChange`).
- In `onSelect` van de Calendar: datum updaten **en** popover sluiten.

### Implementatie

**Nieuwe component**: `src/components/reservations/ReservationDatePicker.tsx`
- Props: `value: Date`, `onChange: (d: Date) => void`, `restaurantId: string`, optioneel `triggerClassName` en `align`.
- Houdt intern `open` en `month` (zichtbare maand) bij.
- `useQuery` op key `["reservation-dates", restaurantId, yyyymm]` haalt distinct `reservation_date` op voor de zichtbare maand (start–eind van de maand, status ≠ `cancelled`) en parsed naar `Date[]`.
- Rendert `Popover` + bestaande `Button` trigger met `CalendarIcon` + `format(value, "EEEE d MMMM", { locale: nl })`.
- Geeft aan `Calendar`: `month`, `onMonthChange`, `modifiers={{ hasReservations: dates }}`, `modifiersClassNames={{ hasReservations: "tw-has-reservations" }}`.
- `onSelect` → `onChange(d)` + `setOpen(false)`.

**CSS** in `src/index.css`:
```css
.tw-has-reservations { position: relative; }
.tw-has-reservations::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 4px;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: hsl(var(--primary));
}
.rdp-day_selected.tw-has-reservations::after {
  background: hsl(var(--primary-foreground));
}
```

**Vervangen**: de inline `Popover` + `Calendar` blokken in:
- `src/pages/app/AgendaPage.tsx` (regels ±426-436)
- `src/pages/app/ReservationsPage.tsx` (regels ±271-281)
- `src/pages/app/FloorModePage.tsx` (analoog blok)

door `<ReservationDatePicker value={date} onChange={setDate} restaurantId={current.restaurant_id} />`.

Geen wijzigingen aan business logic of edge functions.
