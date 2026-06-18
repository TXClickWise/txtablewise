## Doel

1. Geannuleerde reserveringen verbergen uit alle operationele overzichten (Agenda, Vloer, Today, Wachtlijst-matches, Floor Mode, Reservations lijst). Ze blijven bestaan in de database en zichtbaar in **Rapportages** en **Gasthistorie** (voor no-show signalen, herhaalbezoek, audit).
2. Op de Gastenpagina meerdere gasten kunnen selecteren en verwijderen — geblokkeerd met heldere waarschuwing als de gast nog actieve (pending/confirmed/seated) of toekomstige reserveringen heeft.

## Wat verandert er (UX)

### Annulering = direct weg uit operatie
- Annuleren door medewerker of via self-service blijft hetzelfde mechanisme (`manage_reservation` → status `cancelled`). Geen hard delete.
- **Filter "Geannuleerd" wordt verwijderd** uit de Reservations filterbar, Agenda day-view en Week-view. Geannuleerde rijen worden niet meer gerenderd.
- **Floor Mode / Today / Vloer**: cancelled rijen worden al uitgesloten in een paar plekken, dit wordt consistent doorgevoerd (incl. KPI's, "volgende reservering per tafel", waarschuwingen).
- **Wachtlijst match-suggesties** en **LastMinuteFillPanel** negeren cancelled.
- **ReservationDetailDialog** blijft openbaar via directe link (bv. uit Rapportages of gasthistorie) — daar zie je nog wel de cancelled-status met reden.
- **Rapportages** en **GuestReservationHistory** (gastdetail-sheet) blijven cancelled tonen, want die zijn nodig voor no-show signalen en hospitality-context.

### Gasten verwijderen (enkel + bulk)
Op `/app/gasten`:
- Selectie-checkbox per rij + "Alles op deze pagina selecteren".
- Selectie-actiebalk verschijnt zodra ≥1 gast geselecteerd is: aantal + knop **Verwijderen**.
- Bevestigingsdialoog met telling. Bij klikken roept de UI een nieuwe RPC `delete_guests_safe(_guest_ids uuid[])` aan die per gast checkt of er **actieve reserveringen** zijn (status in pending/confirmed/seated **of** start_time in de toekomst).
- Resultaat: lijst van verwijderd vs. geblokkeerd. Geblokkeerde gasten worden in de dialoog getoond met aantal toekomstige reserveringen + tip "Annuleer eerst de openstaande reservering(en)".
- Detail-sheet krijgt ook een **Verwijderen**-knop (single delete via dezelfde RPC).

## Technische details

### Frontend
- **`src/lib/reservationFilters.ts`** (nieuw): één helper `isActiveReservation(r)` → exclude cancelled, no_show, completed waar relevant. Gebruik consistent in:
  - `src/pages/app/AgendaPage.tsx` — verwijder cancelled-styling/case op regel 58, filter cancelled overal uit lijst-rendering (niet meer alleen op 331/1132), verwijder `isLockedStatus`-tak voor cancelled.
  - `src/components/reservations/views/WeekView.tsx` + `TableGridView.tsx` — cancelled style weghalen, rijen niet renderen.
  - `src/components/reservations/ReservationFilterBar.tsx` — "Geannuleerd"-tab eruit; type `StatusFilter` opschonen.
  - `src/pages/app/FloorModePage.tsx` — `.in("status", …)` blijft zoals het is (al exclusief), maar dubbel-check overige filters.
  - `src/pages/app/TodayPage.tsx`, `src/components/reservations/ReservationCard.tsx`, `ReservationStatusQuickBar.tsx` — cancelled-takken verbergen (niet verwijderen uit type).
  - `WaitlistMatchSuggestions.tsx`, `LastMinuteFillPanel.tsx`: filter cancelled uit kandidaten.
- **`src/pages/app/ReportsPage.tsx`** + `services/reporting.ts` — ongewijzigd, blijven cancelled meenemen.
- **`src/components/guests/GuestReservationHistory.tsx`** — ongewijzigd; toont cancelled met StatusBadge.

### Gastenpagina UI
- **`src/pages/app/GuestsPage.tsx`**: state `selectedIds: Set<string>`. Toggle per rij (checkbox links naast avatar). Sticky actiebalk onder header met "X geselecteerd · Verwijderen · Selectie wissen". Bevestiging via `AlertDialog`.
- **`src/services/guests.ts`**: nieuwe `deleteGuests(ids: string[])` → roept RPC aan en mapt response.
- **`src/components/guests/GuestDetailSheet`** (in GuestsPage.tsx ingebouwd): "Verwijderen"-knop naast "Wijzigen".

### Backend (migratie)
Nieuwe `SECURITY DEFINER` RPC:

```sql
create or replace function public.delete_guests_safe(_guest_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _r_id uuid;
  _deleted uuid[] := '{}';
  _blocked jsonb := '[]'::jsonb;
  _g record;
  _blocking_count int;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;

  for _g in select id, restaurant_id, first_name, last_name from public.guests where id = any(_guest_ids) loop
    -- permission check per gast
    if not (public.is_restaurant_manager(_g.restaurant_id) or public.is_system_admin()) then
      continue;
    end if;

    select count(*) into _blocking_count
      from public.reservations
      where guest_id = _g.id
        and (status in ('pending','confirmed','seated')
             or start_time > now());

    if _blocking_count > 0 then
      _blocked := _blocked || jsonb_build_object(
        'guest_id', _g.id,
        'name', trim(coalesce(_g.first_name,'') || ' ' || coalesce(_g.last_name,'')),
        'active_reservations', _blocking_count
      );
    else
      delete from public.guest_notes where guest_id = _g.id;
      delete from public.guests where id = _g.id;
      _deleted := array_append(_deleted, _g.id);
    end if;
  end loop;

  return jsonb_build_object('deleted', _deleted, 'blocked', _blocked);
end;
$$;
```

Reservation-FK naar `guests` blijft `on delete set null` (bestaande historische reserveringen verliezen geen data, alleen guest_id wordt leeggemaakt). Audit log entry per delete-batch.

## Wat NIET verandert
- Geen hard delete van reserveringen — alleen verbergen uit operationele views.
- `manage_reservation` edge function blijft ongewijzigd.
- Rapportages en no-show signalen blijven volledig werken.
- RLS-policies op `guests` blijven; RPC handelt manager-check intern af.

## Verificatie
1. Annuleer reservering → verdwijnt uit Agenda dag/week, Reservations lijst, Floor Mode, Today. Verschijnt nog in gastsheet → Bezoekhistorie en in Rapportages.
2. Filter "Geannuleerd" is weg uit de filter-tabs.
3. Selecteer 2 gasten zonder actieve reserveringen → verwijderen lukt, lijst ververst.
4. Probeer gast met toekomstige reservering te verwijderen → geblokkeerd met telling in dialoog.
5. Single delete in detail-sheet werkt identiek.
