## Doel

Eén consistente regel voor verblijfsduur, met twee drempels:

- **Vanaf "Grote groep"-drempel** (bv. 8 personen) → vaste verblijfsduur uit `large_group_minutes` (bv. 120 min).
- **Vanaf "Extra-grote groep"-drempel** (nieuw, bv. 16 personen) → daar bovenop nog `large_group_extra_minutes` (bv. +30, dus 150 min).

Alle plekken (availability, book, manage, floor) gebruiken dezelfde formule.

## Wijzigingen

### 1. Database
Migratie: nieuwe kolom op `restaurants`:
- `extra_large_group_threshold integer` (nullable, default `NULL` = feature uit).

`large_group_minutes` en `large_group_extra_minutes` blijven bestaan met hun nieuwe, duidelijke betekenis.

### 2. Gedeelde helper
Nieuwe util `supabase/functions/_shared/duration.ts` met één functie:

```text
durationMinutesFor(party_size, restaurant) =
  default_reservation_minutes
  + (party_size >= large_group_threshold ? (large_group_minutes - default_reservation_minutes) : 0)
  + (extra_large_group_threshold && party_size >= extra_large_group_threshold ? large_group_extra_minutes : 0)
```

Toegepast in:
- `supabase/functions/availability/index.ts`
- `supabase/functions/book_reservation/index.ts` (vervangt huidige `baseDuration + extra`)
- `supabase/functions/manage_reservation/index.ts`
- `supabase/functions/public_api/index.ts`
- `supabase/functions/_shared/pacing.ts` (`durationFor`)

Frontend equivalent in `src/lib/duration.ts` voor `ReservationFormSheet` en Floor pagina's.

### 3. UI

**Capaciteit-tab** (`CapacitySettings.tsx`):
- Veld "Verblijfsduur grote groep (min)" krijgt verduidelijkte hint: "Geldt vanaf de grote-groep drempel. Voor extra-grote groepen kun je in de tab Grote groepen nog extra tijd toevoegen."

**Grote groepen-tab** (`LargeGroupSettings.tsx`):
- Nieuw veld **"Extra-grote groep vanaf (personen)"** (optioneel) naast "Extra verblijfsduur (minuten)".
- Hint bij "Extra verblijfsduur": "Wordt alleen opgeteld voor groepen vanaf de extra-grote-groep drempel. Laat het drempel-veld leeg om dit uit te schakelen."
- Bij lege drempel: extra minuten wordt nooit toegepast — kleine info-regel toont dat.

**ReservationFormSheet**: regel "Verblijfsduur is automatisch +X minuten" wordt vervangen door dynamische berekende totale duur ("Verblijfsduur: 150 min").

### 4. Validatie
Frontend save in beide tabs:
- `large_group_minutes >= default_reservation_minutes` (anders waarschuwing).
- `extra_large_group_threshold > large_group_threshold` indien gezet.

## Resultaat voor eigeweis

Met huidige defaults (drempel 8, large 150, extra 30):
- 1–7 pers → 90 min
- 8–15 pers → 150 min
- 16+ pers (als extra-drempel op 16 staat) → 180 min

Wil je liever 8–15 = 120 min en 16+ = 150 min, dan zet je `large_group_minutes` op 120 en de extra-drempel op 16. Geen conflict meer tussen widget-availability en daadwerkelijke boeking.

## Niet in scope

- Geen UI voor automatische aanbeveling van defaults.
- Geen migratie van bestaande waarden — defaults blijven werken zoals voorheen, omdat de extra-drempel default `NULL` is (extra minuten niet toegepast).
