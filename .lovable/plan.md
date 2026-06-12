
# Zones: online beschikbaarheid

## Doel
Per zone instelbaar of die zone gebruikt mag worden voor online reserveringen (widget). Medewerkers kunnen tafels in "offline" zones gewoon handmatig blijven gebruiken voor walk-ins en telefonische / handmatige reserveringen.

## Wijzigingen

### 1. Database
- Migration: `ALTER TABLE public.zones ADD COLUMN bookable_online boolean NOT NULL DEFAULT true;`
- Geen RLS-aanpassingen nodig (bestaande zones-policies blijven gelden).

### 2. Settings UI — `src/pages/app/settings/ZonesTablesSettings.tsx`
- Per zone-rij een extra toggle "Online reserveren" (Switch).
- Toggle update `zones.bookable_online` via supabase.
- Korte hint onder de lijst: "Uitgeschakelde zones zijn niet zichtbaar in de widget. Medewerkers kunnen er nog wel handmatig op plaatsen."

### 3. Beschikbaarheidsengine — `supabase/functions/availability/index.ts` en `supabase/functions/book_reservation/index.ts`
- Bij het ophalen van tafels voor **online** kanalen alleen tafels meenemen waarvan de zone `bookable_online = true` is (of `zone_id IS NULL` blijft toegestaan — geen zone = altijd boekbaar).
- `book_reservation`: als `channel = "online"` (of source via widget/google/instagram/qr/external_platform) en de gekozen/toegewezen tafel hoort bij een offline zone → afwijzen met duidelijke melding (zou normaal niet voor mogen komen want availability filtert al).
- `channel = "manual"` / `walk_in` / `phone_ai` / staff-entry blijft ongewijzigd: alle actieve zones beschikbaar.

### 4. Widget — `src/components/OnlineReservationWidget.tsx`
- Hardcoded zone-voorkeurslijst (`binnen`, `terras`, `geen voorkeur`) vervangen door dynamische lijst uit `zones` waarbij `is_active = true AND bookable_online = true`.
- Als er <2 boekbare zones zijn → zone-keuze niet tonen.
- Selectie blijft als tekstuele `special_request` opgeslagen (geen datamodel-wijziging aan reservations nodig).

### 5. Widget API — `supabase/functions/widget_api/index.ts`
- Endpoint dat zones aan widget exposeert filteren op `bookable_online = true`.

## Niet-doel
- Geen wijziging aan vloer/floor plan, walk-in flow, AI Quick Seat of telefonische flow — die blijven alle actieve zones tonen.
- Geen aanbetalings- of pacing-logica gewijzigd.

## Acceptatiecriteria
1. Owner zet zone "Terras" uit voor online → terras-tafels verschijnen niet meer in widget availability.
2. Zone-keuze in widget toont alleen online-actieve zones.
3. Medewerker kan via Vloer / Walk-in / Quick Seat nog steeds een terras-tafel kiezen en bezetten.
4. Handmatig aangemaakte reservering (channel ≠ online) op een offline zone werkt zonder fout.
