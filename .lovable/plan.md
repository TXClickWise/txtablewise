# Plan: Eén workflow voor grote groepen — volledig configureerbaar per tenant

Alle drempels blijven per restaurant instelbaar in **Instellingen → Reserveringen → Grote groepen** en **Capaciteit**. De voorbeelden hieronder (8/10/18) zijn fictief — elke tenant kiest zelf de waarden.

## Principe

Eén pad voor álle groepsgroottes binnen `max_party_size_online`:
- Onder `large_group_manual_approval_from` → direct bevestigd online
- Vanaf `large_group_manual_approval_from` t/m `max_party_size_online` → `pending`, personeel keurt goed in app

Boven `max_party_size_online` → **óók `pending`**, maar met verplicht extra "bericht aan restaurant" veld. Het losse `LargeGroupForm` vervalt als primaire route.

## Nieuwe / aangepaste instellingen op `restaurants`

| Veld | Doel | Bestaand? |
|---|---|---|
| `max_party_size_online` | Hard maximum dat de widget aanbiedt als time-slot keuze | bestaat |
| `large_group_manual_approval_from` | Vanaf dit aantal `pending` ipv `confirmed` | bestaat |
| `large_group_threshold` | Vanaf hier "grote groep" markering + extra verblijfsduur | bestaat |
| `large_group_extra_info_from` *(nieuw)* | Vanaf hier verplicht "bericht aan restaurant" veld in widget | toevoegen |
| `large_group_max_online_request` *(nieuw)* | Bovengrens voor `pending` aanvragen via widget (boven `max_party_size_online`). Default = `max_party_size_online`. Boven dit aantal volgt fallback naar los formulier of melding "neem telefonisch contact op" | toevoegen |

Defaults houden we conservatief, identiek aan huidige veldwaarden, zodat niets breekt voor bestaande tenants.

## Wijzigingen frontend (widget)

`src/pages/ReserveWidget.tsx`:
- Party-size selector toont **1 t/m `max_party_size_online`** ipv hard cap op 8.
- Als gevraagd `party_size > max_party_size_online` maar `≤ large_group_max_online_request` → toon time-slots + verplicht "bericht aan restaurant" textarea als `party_size ≥ large_group_extra_info_from`.
- Boven `large_group_max_online_request` → fallback naar bestaand `LargeGroupForm` (of telefoon-melding, instelbaar later).
- Bij groepen `≥ large_group_manual_approval_from` toon banner: "Je aanvraag wordt binnen X uur persoonlijk bevestigd" met `large_group_confirmation_text`.

## Wijzigingen frontend (instellingen)

`src/pages/app/settings/LargeGroupSettings.tsx`:
- Twee nieuwe velden: `large_group_extra_info_from`, `large_group_max_online_request`.
- Korte uitleg per veld in NL met hospitality-toon.
- Validatie: `large_group_manual_approval_from ≤ max_party_size_online ≤ large_group_max_online_request`.

`src/pages/app/settings/CapacitySettings.tsx`:
- Geen wijziging; `max_party_size_online` blijft in Algemeen / Widget settings (waar het nu staat).

## Wijzigingen backend (edge functions)

`supabase/functions/book_reservation/index.ts` en `public_api`:
- Accepteer `party_size` tot `large_group_max_online_request` (ipv harde grens op `max_party_size_online`).
- Verplicht `message` als `party_size ≥ large_group_extra_info_from`.
- Forceer `status = pending` + `requires_manual_approval = true` vanaf `large_group_manual_approval_from`.
- Gebruik consistent `findAvailableCombination` (al aanwezig in `_shared/reservation-utils.ts`) voor groepen die niet op één tafel passen.

`supabase/functions/manage_reservation/index.ts`:
- Idem: bij wijziging valt logica terug op tafelcombinaties.

`supabase/functions/availability/index.ts`:
- Toon time-slots tot `large_group_max_online_request` mits er een actieve combinatie bestaat die past.

## Wijzigingen walk-in / operator flows

`src/components/walk-in/WalkInQuickSheet.tsx` + `src/services/walkIn.ts`:
- Bij grote groep zonder vrije enkele tafel: zoek actieve combinatie via dezelfde util en wijs combinatie toe (gebruikt `reservation_tables` + `table_combination_id`).

`src/components/reservations/ReservationFormSheet.tsx`:
- Idem fallback naar combinaties in operator-boekingen.

## Database migratie

Twee kolommen toevoegen op `restaurants`, beiden nullable met defaults gelijk aan bestaand gedrag:

```text
large_group_extra_info_from        integer null  -- bv. 15, null = nooit verplicht
large_group_max_online_request     integer null  -- null = gelijk aan max_party_size_online
```

Geen RLS-wijzigingen nodig; bestaande policies dekken dit.

## Wat blijft er bestaan?

- `large_group_requests` tabel + `LargeGroupForm` blijven beschikbaar als fallback boven `large_group_max_online_request` of wanneer een datum/tijd geen openingstijd heeft.
- Bestaande grote-groepen pagina (`/app/large-groups`) toont nu zowel `pending` reserveringen als losse aanvragen in dezelfde inbox.

## Validatie

- Test met drie tenant-profielen (klein bistro, middelgroot restaurant, eventlocatie) met sterk verschillende drempels om te bevestigen dat niets gehardcodeerd is.
- Edge function unit-checks op grenswaarden.
- Visueel: widget toont juiste max in dropdown per tenant.

## Volgorde uitvoer

1. Migratie: twee kolommen toevoegen op `restaurants`
2. `LargeGroupSettings` UI: velden + validatie
3. Widget `ReserveWidget.tsx`: dynamische party-size + bericht-veld
4. Edge functions `book_reservation`, `availability`, `public_api`, `manage_reservation`: drempel-logica + combinatie-fallback
5. Walk-in + operator: combinatie-fallback consistent maken
6. Tests met meerdere tenant-configuraties
