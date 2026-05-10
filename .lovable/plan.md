## Doel
De tafelgrid in `/app/reserveringen` (component `TableGridView`) wordt een werkbaar planbord: tafelnamen altijd in beeld, in beide assen zoombaar, en lege tijdslots openen direct een boekings­scherm met de juiste starttijd voorgeselecteerd.

## Wijzigingen

### 1. `src/components/reservations/views/TableGridView.tsx`

**Sticky tafelkolom (links altijd in beeld)**
- Buitenste container blijft horizontaal scrollbaar.
- Headerrij en elke tafelrij krijgen een eerste cel met `position: sticky; left: 0; z-index: 20` (header `z-30`), volledige achtergrond `bg-card` en rechterborder, zodat de tafelnaam over de timeline-cellen heen blijft staan tijdens horizontaal scrollen.

**Verticaal zoomen**
- Naast horizontale `PX_PER_MIN` (zoom-X) een `ROW_HEIGHT` state (zoom-Y), default 56, range 40–120.
- Boven het grid: bestaande zoom-knoppen blijven X-zoom; daarnaast een tweede paar (− / +) met label “Hoogte”. Twee knoppen i.p.v. één gedeelde slider om duidelijk te houden welke as je beïnvloedt.
- Pas `height` van elke rij en `top/bottom` van elke reserveringsblok aan op basis van `ROW_HEIGHT` (blokken `top: 6px; height: ROW_HEIGHT - 12`).

**Tijdlijn opdelen in kwartieren**
- `SLOT_MIN` blijft 30 voor labelposities, maar de klikbare lagen worden 15 minuten.
- Achter de bestaande borders een laag `<button>`-cellen renderen, één per 15 min per tafelrij, breedte `15 * PX_PER_MIN`. Visueel: lichte `border-l border-border/20` op elk kwartier; uur-borders blijven sterker.
- Hover/active feedback op deze cellen: `hover:bg-primary/5 active:bg-primary/10`.

**Klikken op een leeg tijdslot opent boekingsscherm**
- `onCreate` prop toevoegen: `(args: { tableId: string; tableLabel: string; startTime: string /* HH:mm */; }) => void`.
- Klik-handler op een kwartier-cel berekent de startijd:
  1. Standaard = de aangeklikte kwartiertijd.
  2. Bestaande reservering op die tafel zoeken die `startMin ≤ click < endMin` overlapt:
     - Klik vóór een bestaande reservering (klik-tijd < res.start): start = klik-tijd, mits `klik + defaultDuration ≤ res.start`. Anders start = `res.start − defaultDuration` (geclampt op `now`/openingstijd).
     - Klik direct ná een bestaande reservering (klik valt binnen het slot dat aansluit op `res.end`): start = `res.end`.
     - Klik op blok zelf: niet aanmaken — dit triggert de bestaande `onOpen(reservation.id)` flow (reservering-detail).
  3. Klik in verleden van vandaag → start = `max(klik, nu afgerond op volgend kwartier)`.
- `defaultDuration` halen uit `restaurant.default_reservation_minutes` (laden via `useRestaurant`); `large_group_minutes` gebruiken voor groepen — relevant pas in stap 2 omdat `partySize` nog onbekend is bij klik. Voor de starttijd-berekening volstaat `default_reservation_minutes`.

### 2. `src/components/reservations/ReservationFormSheet.tsx`

- Nieuwe optionele prop:
  ```ts
  prefill?: {
    date?: string;        // YYYY-MM-DD
    time?: string;        // HH:mm
    tableId?: string;
    tableLabel?: string;
    partySize?: number;
    sourceChannel?: "walk_in" | "manual_phone" | "staff_entry";
  }
  ```
- Bij `open` true en `prefill` aanwezig: `setDate`, `setTime`, `setPartySize`, en pre-selecteer de tafel zodra de tafel-suggesties binnen zijn (zelfde patroon als WalkInQuickSheet: `if (open && !tableId && prefill?.tableId) setTableId(prefill.tableId)`).
- Velden blijven gewoon bewerkbaar.
- Knop “Walk-in nu” bovenin: secundaire actie die — i.p.v. de form — `WalkInQuickSheet` opent met dezelfde prefill (pas in stap 3 als de operator zegt “toch walk-in”). Optioneel; als simpel, eerst alleen reservering.

### 3. `src/pages/app/ReservationsPage.tsx`

- State `createPrefill` toevoegen.
- `<TableGridView ... onCreate={(p) => { setCreatePrefill({ date: format(date,"yyyy-MM-dd"), time: p.startTime, tableId: p.tableId, tableLabel: p.tableLabel }); setCreateOpen(true); }} />`.
- `<ReservationFormSheet open={createOpen} onOpenChange={(o)=>{ setCreateOpen(o); if(!o) setCreatePrefill(undefined); }} prefill={createPrefill} />`.

## Niet binnen scope (om de PR klein te houden)
- DayView/WeekView krijgen geen sticky/zoom-Y aanpassingen (alleen TableGridView).
- Walk-in routing vanuit het grid: voor nu opent altijd `ReservationFormSheet`. Walk-in switch eventueel in vervolgwijziging.

## QA
1. Horizontaal scrollen: tafelkolom blijft zichtbaar, header-cel staat boven tafelkolom.
2. Y-zoom +/−: rijen worden hoger/lager, blokken schalen mee, layout breekt niet.
3. Klik in leeg slot vóór een bestaande reservering om 18:30: nieuw boekingsscherm met starttijd = klik-tijd; tafel + datum voorgevuld.
4. Klik direct ná die reservering: starttijd = 19:30 (= res.end).
5. Klik op het reserveringsblok zelf: opent reservering-detail (onveranderd).
6. Klik in verleden vandaag (vóór `now`): starttijd verschuift naar het eerstvolgende kwartier ≥ nu.
7. Velden in formulier zijn gewoon aanpasbaar; opslaan creëert reservering met juiste tafel via bestaande flow.
